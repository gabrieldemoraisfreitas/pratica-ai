import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import prisma from '../prisma';
import { createAuthToken } from '../lib/auth';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { loginSchema, registerSchema } from '../../shared/schemas/user';

const safeUserSelect = {
  id: true,
  email: true,
  nome: true,
  interests: true,
  avatar: true,
  createdAt: true,
} as const;

const loginUserSelect = {
  id: true,
  email: true,
  nome: true,
  senha: true,
  interests: true,
  avatar: true,
  createdAt: true,
  tokenVersion: true,
} as const;

export type CreateUserInput = {
  email: string;
  nome?: string | null;
  senha: string;
  interests?: string | null;
  avatar?: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'senha'>> & {
  senha?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatSchemaError(error: ZodError) {
  return error.issues[0]?.message || 'Dados invalidos';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} invalido`, 'INVALID_INPUT');
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function validateEmail(email: string) {
  if (!emailRegex.test(email)) {
    throw badRequest('Email invalido', 'INVALID_EMAIL');
  }
}

function validatePassword(password: string) {
  if (!password.trim()) {
    throw badRequest('Senha obrigatoria', 'INVALID_PASSWORD');
  }

  if (password.trim().length < 6) {
    throw badRequest('A senha precisa ter pelo menos 6 caracteres', 'INVALID_PASSWORD');
  }
}

export function safeUser<TUser extends {
  id: string;
  email: string;
  nome: string | null;
  interests?: string | null;
  avatar?: string | null;
  createdAt?: Date;
}>(user: TUser) {
  return {
    id: user.id,
    email: user.email,
    nome: user.nome ?? null,
    interests: user.interests ?? null,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt,
  };
}

export async function listarUsuarios(currentUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId,
      },
    },
    select: safeUserSelect,
    orderBy: { createdAt: 'desc' },
  });

  return users.map(safeUser);
}

export async function buscarUsuarioPorId(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

  return user ? safeUser(user) : null;
}

export async function buscarUsuarioPorEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: loginUserSelect,
  });
}

export async function criarUsuario(data: CreateUserInput) {
  let parsedData;

  try {
    parsedData = registerSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest(formatSchemaError(error), 'INVALID_USER_INPUT');
    }

    throw error;
  }

  const email = parsedData.email;
  const nome = parsedData.nome ?? null;
  const senha = parsedData.senha;

  const existingUser = await buscarUsuarioPorEmail(email);

  if (existingUser) {
    throw badRequest('Ja existe um usuario com esse email', 'EMAIL_ALREADY_EXISTS');
  }

  const hashedPassword = await bcrypt.hash(senha.trim(), 10);

  let user;

  try {
    user = await prisma.user.create({
      data: {
        email,
        nome: normalizeOptionalText(nome, 'Nome'),
        senha: hashedPassword,
        interests: normalizeOptionalText(parsedData.interests ?? null, 'Interesses'),
        avatar: normalizeOptionalText(parsedData.avatar, 'Avatar'),
        tokenVersion: 0,
      },
      select: {
        ...safeUserSelect,
        tokenVersion: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw badRequest('Ja existe um usuario com esse email', 'EMAIL_ALREADY_EXISTS');
      }

      if (error.code === 'P2011') {
        throw badRequest(
          'Schema do banco desatualizado: nome e interesses precisam aceitar valores nulos.',
          'USER_SCHEMA_REQUIRES_NULLABLE_PROFILE_FIELDS',
        );
      }
    }

    throw error;
  }

  return {
    token: createAuthToken(user.id, user.tokenVersion),
    user: safeUser(user),
  };
}

export async function validarLogin(email: string, senha: string) {
  let parsedData;

  try {
    parsedData = loginSchema.parse({ email, senha });
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest(formatSchemaError(error), 'INVALID_LOGIN_INPUT');
    }

    throw error;
  }

  const normalizedEmail = parsedData.email;
  const normalizedPassword = parsedData.senha;

  const user = await buscarUsuarioPorEmail(normalizedEmail);

  if (!user) {
    throw unauthorized('Email ou senha invalidos');
  }

  const senhaValida = await bcrypt.compare(normalizedPassword.trim(), user.senha);

  if (!senhaValida) {
    throw unauthorized('Email ou senha invalidos');
  }

  return {
    token: createAuthToken(user.id, user.tokenVersion),
    user: safeUser(user),
  };
}

export async function buscarPerfilAtual(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });

  if (!user) {
    throw notFound('Usuario nao encontrado', 'USER_NOT_FOUND');
  }

  return safeUser(user);
}

export async function atualizarUsuario(id: string, data: UpdateUserInput) {
  if (data.nome !== undefined && (typeof data.nome !== 'string' || !data.nome.trim())) {
    throw badRequest('Nome invalido', 'INVALID_NAME');
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingUser) {
    throw notFound('Usuario nao encontrado', 'USER_NOT_FOUND');
  }

  if (data.email) {
    const normalizedEmail = normalizeEmail(data.email);
    validateEmail(normalizedEmail);

    const emailInUse = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: {
          not: id,
        },
      },
      select: { id: true },
    });

    if (emailInUse) {
      throw conflict('Ja existe um usuario com esse email', 'EMAIL_ALREADY_EXISTS');
    }

    data.email = normalizedEmail;
  }

  const updateData: Record<string, string | null | undefined> = {
    email: data.email,
    nome: data.nome === undefined ? undefined : data.nome.trim(),
    interests: normalizeOptionalText(data.interests, 'Interesses'),
    avatar: normalizeOptionalText(data.avatar, 'Avatar'),
  };

  if (data.senha) {
    validatePassword(data.senha);
    updateData.senha = await bcrypt.hash(data.senha.trim(), 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...updateData,
      ...(data.senha ? { tokenVersion: { increment: 1 } } : {}),
    },
    select: safeUserSelect,
  });

  return safeUser(user);
}
