import prisma from '../prisma';
import { badRequest, notFound } from '../lib/errors';

const MAX_REVIEW_INTERVAL = 30;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getTime() + days * ONE_DAY_IN_MS);
}

function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${fieldName} invalido`, 'INVALID_FLASHCARD_INPUT');
  }

  return value.trim();
}

export async function buscarFlashcardsPorMateria(materiaId: string, userId: string) {
  return prisma.flashcard.findMany({
    where: {
      materiaId,
      materia: {
        userId,
      },
    },
    include: { revisoes: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function buscarFlashcardPorId(id: string, userId: string) {
  const flashcard = await prisma.flashcard.findFirst({
    where: {
      id,
      materia: {
        userId,
      },
    },
    include: { revisoes: true, materia: true },
  });

  if (!flashcard) {
    throw notFound('Flashcard nao encontrado', 'FLASHCARD_NOT_FOUND');
  }

  return flashcard;
}

export async function buscarFlashcardsPendentes(userId: string) {
  return prisma.flashcard.findMany({
    where: {
      materia: {
        userId,
      },
      nextReview: {
        lte: new Date(),
      },
    },
    include: {
      materia: true,
      revisoes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function contarFlashcardsPendentes(userId: string) {
  return prisma.flashcard.count({
    where: {
      materia: {
        userId,
      },
      nextReview: {
        lte: new Date(),
      },
    },
  });
}

export async function criarFlashcard(data: {
  pergunta: string;
  resposta: string;
  dificuldade?: number;
  materiaId: string;
  userId: string;
  nextReview?: Date;
  reviewInterval?: number;
}) {
  if (data.dificuldade !== undefined && (!Number.isInteger(data.dificuldade) || data.dificuldade < 1 || data.dificuldade > 5)) {
    throw badRequest('dificuldade invalida', 'INVALID_FLASHCARD_DIFFICULTY');
  }

  const materia = await prisma.materia.findFirst({
    where: {
      id: data.materiaId,
      userId: data.userId,
    },
    select: { id: true },
  });

  if (!materia) {
    throw notFound('Materia nao encontrada', 'MATERIA_NOT_FOUND');
  }

  return prisma.flashcard.create({
    data: {
      pergunta: normalizeRequiredText(data.pergunta, 'Pergunta'),
      resposta: normalizeRequiredText(data.resposta, 'Resposta'),
      dificuldade: data.dificuldade,
      materiaId: data.materiaId,
      nextReview: data.nextReview ?? new Date(),
      reviewInterval: data.reviewInterval ?? 1,
    },
  });
}

export async function atualizarFlashcard(
  id: string,
  userId: string,
  data: {
    pergunta?: string;
    resposta?: string;
    dificuldade?: number;
  },
) {
  await buscarFlashcardPorId(id, userId);

  if (data.dificuldade !== undefined && (!Number.isInteger(data.dificuldade) || data.dificuldade < 1 || data.dificuldade > 5)) {
    throw badRequest('dificuldade invalida', 'INVALID_FLASHCARD_DIFFICULTY');
  }

  return prisma.flashcard.update({
    where: { id },
    data: {
      pergunta: data.pergunta === undefined ? undefined : normalizeRequiredText(data.pergunta, 'Pergunta'),
      resposta: data.resposta === undefined ? undefined : normalizeRequiredText(data.resposta, 'Resposta'),
      dificuldade: data.dificuldade,
    },
  });
}

export async function revisarFlashcard(
  id: string,
  userId: string,
  payload: {
    acertou: boolean;
    tempoResposta?: number;
  },
) {
  const flashcard = await buscarFlashcardPorId(id, userId);

  if (
    payload.tempoResposta !== undefined &&
    (!Number.isFinite(payload.tempoResposta) || payload.tempoResposta < 0)
  ) {
    throw badRequest('tempoResposta invalido', 'INVALID_FLASHCARD_REVIEW_TIME');
  }

  const reviewInterval = payload.acertou
    ? Math.min((flashcard.reviewInterval || 1) * 2, MAX_REVIEW_INTERVAL)
    : 1;

  const now = new Date();
  const nextReview = addDays(now, reviewInterval);

  const [updatedFlashcard] = await prisma.$transaction([
    prisma.flashcard.update({
      where: { id },
      data: {
        reviewInterval,
        nextReview,
        lastReviewedAt: now,
      },
      include: { revisoes: true, materia: true },
    }),
    prisma.revisao.create({
      data: {
        flashcardId: id,
        acertou: payload.acertou,
        tempoResposta: payload.tempoResposta,
      },
    }),
  ]);

  return updatedFlashcard;
}

export async function deletarFlashcard(id: string, userId: string) {
  await buscarFlashcardPorId(id, userId);

  return prisma.flashcard.delete({
    where: { id },
  });
}
