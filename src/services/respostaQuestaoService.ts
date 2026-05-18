import prisma from '../prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';

export async function salvarRespostaQuestao(data: {
  userId: string;
  questaoId: string;
  acertou: boolean;
  resposta?: string;
  tempoResposta?: number;
  desafioId?: string;
  skipOwnershipCheck?: boolean;
}) {
  const questao = await prisma.questao.findUnique({
    where: { id: data.questaoId },
    select: {
      id: true,
      materia: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!questao) {
    throw notFound('Questao nao encontrada', 'QUESTAO_NOT_FOUND');
  }

  if (!data.skipOwnershipCheck && questao.materia.userId !== data.userId) {
    throw forbidden('Voce nao pode registrar resposta para uma questao que nao pertence a sua conta');
  }

  if (data.resposta !== undefined && typeof data.resposta !== 'string') {
    throw badRequest('Resposta invalida', 'INVALID_QUESTION_ANSWER');
  }

  if (
    data.tempoResposta !== undefined &&
    (!Number.isFinite(data.tempoResposta) || data.tempoResposta < 0)
  ) {
    throw badRequest('tempoResposta invalido', 'INVALID_QUESTION_TIME');
  }

  const existing = await prisma.respostaQuestao.findFirst({
    where: {
      userId: data.userId,
      questaoId: data.questaoId,
      desafioId: data.desafioId ?? null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.respostaQuestao.update({
      where: { id: existing.id },
      data: {
        acertou: data.acertou,
        resposta: data.resposta?.trim() || undefined,
        tempoResposta: data.tempoResposta,
        createdAt: new Date(),
      },
      include: {
        questao: true,
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  }

  return prisma.respostaQuestao.create({
    data: {
      userId: data.userId,
      questaoId: data.questaoId,
      desafioId: data.desafioId,
      acertou: data.acertou,
      resposta: data.resposta?.trim() || undefined,
      tempoResposta: data.tempoResposta,
    },
    include: {
      questao: true,
      user: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  });
}
