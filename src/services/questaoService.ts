import prisma from '../prisma';
import { badRequest, notFound } from '../lib/errors';

function normalizeRequiredText(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${fieldName} invalido`, 'INVALID_QUESTAO_INPUT');
  }

  return value.trim();
}

function normalizeOptionalText(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} invalido`, 'INVALID_QUESTAO_INPUT');
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

export async function listarQuestoes(materiaId: string, userId: string) {
  return prisma.questao.findMany({
    where: {
      materiaId,
      materia: {
        userId,
      },
    },
    include: {
      respostas: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function criarQuestao(data: {
  enunciado: string;
  resposta: string;
  tipo?: string;
  materiaId: string;
  userId: string;
}) {
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

  return prisma.questao.create({
    data: {
      enunciado: normalizeRequiredText(data.enunciado, 'Enunciado'),
      resposta: normalizeRequiredText(data.resposta, 'Resposta'),
      tipo: normalizeOptionalText(data.tipo, 'Tipo'),
      materiaId: data.materiaId,
    },
  });
}

export async function criarQuestoesEmLote(
  questoes: Array<{
    enunciado: string;
    resposta: string;
    tipo?: string;
    materiaId: string;
    userId: string;
  }>,
) {
  const created = [];

  for (const questao of questoes) {
    created.push(await criarQuestao(questao));
  }

  return created;
}

export async function buscarQuestoesPorIds(ids: string[], ownerUserId?: string) {
  return prisma.questao.findMany({
    where: {
      id: {
        in: ids,
      },
      ...(ownerUserId
        ? {
            materia: {
              userId: ownerUserId,
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
}
