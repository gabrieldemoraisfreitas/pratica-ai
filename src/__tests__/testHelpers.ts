import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient, User } from '@prisma/client';

const app = require('../app').default as Express;
const prisma = require('../prisma').default as PrismaClient;
const { createAuthToken } = require('../lib/auth') as typeof import('../lib/auth');

export { app, prisma, request };

export const TEST_EMAIL_DOMAIN = '@test.local';
export const TEST_PASSWORD = 'senha123';

type TestUser = {
  user: User;
  token: string;
  password: string;
};

function uniqueEmail(prefix = 'user') {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;
}

export async function createTestUser(overrides: Partial<Pick<User, 'email' | 'nome'>> & { password?: string } = {}): Promise<TestUser> {
  const password = overrides.password ?? TEST_PASSWORD;
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? uniqueEmail('user'),
      nome: overrides.nome ?? 'Usuario Teste',
      senha: await bcrypt.hash(password, 10),
      tokenVersion: 0,
    },
  });

  return {
    user,
    token: createAuthToken(user.id, user.tokenVersion),
    password,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function sign(unsignedToken: string) {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

export function createExpiredToken(userId: string, tokenVersion = 0) {
  const issuedAt = Math.floor(Date.now() / 1000) - 7200;
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      iat: issuedAt,
      exp: issuedAt + 60,
      iss: 'domino-app',
      aud: 'user',
      tokenVersion,
    }),
  );
  const unsignedToken = `${header}.${payload}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export async function cleanTestData() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        endsWith: TEST_EMAIL_DOMAIN,
      },
    },
    select: { id: true },
  });

  const userIds = users.map((user) => user.id);

  if (!userIds.length) {
    return;
  }

  const materias = await prisma.materia.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const materiaIds = materias.map((materia) => materia.id);

  const flashcards = await prisma.flashcard.findMany({
    where: { materiaId: { in: materiaIds } },
    select: { id: true },
  });
  const flashcardIds = flashcards.map((flashcard) => flashcard.id);

  const questoes = await prisma.questao.findMany({
    where: { materiaId: { in: materiaIds } },
    select: { id: true },
  });
  const questaoIds = questoes.map((questao) => questao.id);

  const desafios = await prisma.desafio.findMany({
    where: {
      OR: [{ criadorId: { in: userIds } }, { convidadoId: { in: userIds } }],
    },
    select: { id: true },
  });
  const desafioIds = desafios.map((desafio) => desafio.id);

  const chats = await prisma.chatConversation.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const chatIds = chats.map((chat) => chat.id);

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { chatId: { in: chatIds } } }),
    prisma.respostaQuestao.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { questaoId: { in: questaoIds } },
          { desafioId: { in: desafioIds } },
        ],
      },
    }),
    prisma.desafio.deleteMany({ where: { id: { in: desafioIds } } }),
    prisma.notificacao.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.revisao.deleteMany({ where: { flashcardId: { in: flashcardIds } } }),
    prisma.flashcard.deleteMany({ where: { id: { in: flashcardIds } } }),
    prisma.questao.deleteMany({ where: { id: { in: questaoIds } } }),
    prisma.progresso.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { materiaId: { in: materiaIds } }] } }),
    prisma.sessaoEstudo.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { materiaId: { in: materiaIds } }] } }),
    prisma.chatConversation.deleteMany({ where: { id: { in: chatIds } } }),
    prisma.materia.deleteMany({ where: { id: { in: materiaIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
