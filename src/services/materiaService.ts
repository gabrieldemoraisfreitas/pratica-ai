import prisma from '../prisma';
import { badRequest, notFound } from '../lib/errors';

export type CreateMateriaInput = {
  nome: string;
  descricao?: string;
  cor?: string;
  userId: string;
};

type PaginationInput = {
  limit?: number;
  offset?: number;
};

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function normalizePagination({ limit, offset }: PaginationInput) {
  const normalizedLimit = limit ?? DEFAULT_PAGE_LIMIT;
  const normalizedOffset = offset ?? 0;

  if (
    !Number.isInteger(normalizedLimit) ||
    normalizedLimit < 1 ||
    normalizedLimit > MAX_PAGE_LIMIT ||
    !Number.isInteger(normalizedOffset) ||
    normalizedOffset < 0
  ) {
    throw badRequest('Paginacao invalida', 'INVALID_PAGINATION');
  }

  return {
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

function normalizeOptionalText(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} invalido`, 'INVALID_MATERIA_INPUT');
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizeNome(nome: unknown) {
  if (typeof nome !== 'string' || !nome.trim()) {
    throw badRequest('Nome da materia invalido', 'INVALID_MATERIA_NAME');
  }

  return nome.trim();
}

export async function buscarMateriasPorUsuario(userId: string) {
  const hoje = new Date();
  const [materias, flashcardsPendentes] = await prisma.$transaction([
    prisma.materia.findMany({
      where: { userId },
      select: {
        id: true,
        nome: true,
        cor: true,
        _count: {
          select: {
            flashcards: true,
            questoes: true,
            chats: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.flashcard.groupBy({
      by: ['materiaId'],
      where: {
        nextReview: {
          lte: hoje,
        },
        materia: {
          userId,
        },
      },
      orderBy: {
        materiaId: 'asc',
      },
      _count: true,
    }),
  ]);

  const pendentesPorMateria = new Map(
    flashcardsPendentes.map((item) => [item.materiaId, item._count]),
  );

  return materias.map((materia) => ({
    id: materia.id,
    nome: materia.nome,
    cor: materia.cor,
    icone: null,
    criadoEm: null,
    _count: {
      flashcards: materia._count.flashcards,
      questoes: materia._count.questoes,
      conversas: materia._count.chats,
    },
    flashcardsPendentes: pendentesPorMateria.get(materia.id) ?? 0,
  }));
}

export async function buscarMateriaPorId(id: string, userId: string) {
  return prisma.materia.findFirst({
    where: { id, userId },
    include: {
      flashcards: {
        include: { revisoes: true },
        orderBy: { createdAt: 'desc' },
      },
      questoes: {
        include: {
          respostas: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      progresso: true,
    },
  });
}

export async function buscarMateriaDoUsuario(id: string, userId: string) {
  const materia = await prisma.materia.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      flashcards: {
        include: { revisoes: true },
        orderBy: { createdAt: 'desc' },
      },
      questoes: {
        include: {
          respostas: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      progresso: true,
    },
  });

  if (!materia) {
    throw notFound('Materia nao encontrada', 'MATERIA_NOT_FOUND');
  }

  return materia;
}

async function garantirMateriaDoUsuario(id: string, userId: string) {
  const materia = await prisma.materia.findFirst({
    where: {
      id,
      userId,
    },
    select: { id: true },
  });

  if (!materia) {
    throw notFound('Materia nao encontrada', 'MATERIA_NOT_FOUND');
  }

  return materia;
}

export async function listarFlashcardsDaMateria(
  id: string,
  userId: string,
  pagination: PaginationInput = {},
) {
  await garantirMateriaDoUsuario(id, userId);
  const { limit, offset } = normalizePagination(pagination);
  const where = {
    materiaId: id,
    materia: {
      userId,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.flashcard.findMany({
      where,
      include: { revisoes: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.flashcard.count({ where }),
  ]);

  return {
    items,
    total,
    limit,
    offset,
  };
}

export async function listarQuestoesDaMateria(
  id: string,
  userId: string,
  pagination: PaginationInput = {},
) {
  await garantirMateriaDoUsuario(id, userId);
  const { limit, offset } = normalizePagination(pagination);
  const where = {
    materiaId: id,
    materia: {
      userId,
    },
  };

  const [items, total] = await prisma.$transaction([
    prisma.questao.findMany({
      where,
      include: { respostas: true },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.questao.count({ where }),
  ]);

  return {
    items,
    total,
    limit,
    offset,
  };
}

export async function criarMateria(data: CreateMateriaInput) {
  return prisma.materia.create({
    data: {
      nome: normalizeNome(data.nome),
      descricao: normalizeOptionalText(data.descricao, 'Descricao'),
      cor: normalizeOptionalText(data.cor, 'Cor'),
      userId: data.userId,
    },
  });
}

export async function atualizarMateria(
  id: string,
  userId: string,
  data: {
    nome?: string;
    descricao?: string;
    cor?: string;
  },
) {
  await buscarMateriaDoUsuario(id, userId);

  const nextData = {
    nome: data.nome === undefined ? undefined : normalizeNome(data.nome),
    descricao: normalizeOptionalText(data.descricao, 'Descricao'),
    cor: normalizeOptionalText(data.cor, 'Cor'),
  };

  return prisma.materia.update({
    where: { id },
    data: nextData,
  });
}

export async function deletarMateria(id: string, userId: string) {
  await buscarMateriaDoUsuario(id, userId);

  return prisma.materia.delete({
    where: { id },
  });
}
