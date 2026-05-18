import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { buscarQuestoesPorIds } from './questaoService';
import { criarNotificacao } from './notificacaoService';
import { badRequest, forbidden, notFound } from '../lib/errors';

type ResultadoMap = Record<string, number>;
type DesafioComParticipantes = Prisma.DesafioGetPayload<{
  include: {
    criador: {
      select: { id: true; nome: true; email: true };
    };
    convidado: {
      select: { id: true; nome: true; email: true };
    };
  };
}>;

function generateToken() {
  return randomUUID().replace(/-/g, '');
}

export async function criarDesafio(data: {
  criadorId: string;
  convidadoId: string;
  questaoIds: string[];
  expiraEm?: Date;
}) {
  if (data.criadorId === data.convidadoId) {
    throw badRequest('Voce nao pode criar um desafio para si mesmo', 'INVALID_CHALLENGE_PARTICIPANT');
  }

  if (data.expiraEm && Number.isNaN(data.expiraEm.getTime())) {
    throw badRequest('Data de expiracao invalida', 'INVALID_CHALLENGE_EXPIRATION');
  }

  const convidado = await prisma.user.findUnique({
    where: { id: data.convidadoId },
    select: { id: true },
  });

  if (!convidado) {
    throw notFound('Usuario convidado nao encontrado', 'INVITED_USER_NOT_FOUND');
  }

  const uniqueQuestaoIds = [...new Set(data.questaoIds)];
  const questoes = await buscarQuestoesPorIds(uniqueQuestaoIds, data.criadorId);

  if (questoes.length !== uniqueQuestaoIds.length) {
    throw forbidden('Voce so pode desafiar com questoes que pertencem a sua conta');
  }

  const token = generateToken();
  const expiraEm = data.expiraEm ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (expiraEm <= new Date()) {
    throw badRequest('A expiracao do desafio precisa estar no futuro', 'INVALID_CHALLENGE_EXPIRATION');
  }

  const desafio = await prisma.desafio.create({
    data: {
      token,
      criadorId: data.criadorId,
      convidadoId: data.convidadoId,
      questoes: uniqueQuestaoIds,
      expiraEm,
    },
  });

  await criarNotificacao({
    userId: data.convidadoId,
    titulo: 'Novo desafio recebido',
    mensagem: 'Um amigo enviou um desafio com questoes para voce responder.',
    tipo: 'desafio',
    link: `/desafios/${desafio.id}?token=${desafio.token}`,
  });

  return desafio;
}

export async function buscarDesafioPorId(id: string, userId: string) {
  const desafio = await prisma.desafio.findUnique({
    where: { id },
    include: {
      criador: {
        select: { id: true, nome: true, email: true },
      },
      convidado: {
        select: { id: true, nome: true, email: true },
      },
    },
  });

  if (!desafio) {
    return null;
  }

  validarParticipanteDesafio(desafio, userId);

  return desafio;
}

async function buscarDesafioOuFalhar(desafioId: string) {
  const desafio = await prisma.desafio.findUnique({
    where: { id: desafioId },
  });

  if (!desafio) {
    throw notFound('Desafio nao encontrado', 'DESAFIO_NOT_FOUND');
  }

  return desafio;
}

function validarParticipanteDesafio(
  desafio: {
    criadorId: string;
    convidadoId: string;
  },
  userId: string,
) {
  if (desafio.criadorId !== userId && desafio.convidadoId !== userId) {
    throw forbidden('Voce nao participa deste desafio');
  }
}

export async function buscarDesafioPorToken(token: string, userId: string) {
  const desafio = await prisma.desafio.findUnique({
    where: { token },
    include: {
      criador: {
        select: { id: true, nome: true, email: true },
      },
      convidado: {
        select: { id: true, nome: true, email: true },
      },
    },
  });

  if (!desafio) {
    return null;
  }

  validarParticipanteDesafio(desafio, userId);

  const questaoIds = Array.isArray(desafio.questoes) ? (desafio.questoes as string[]) : [];
  const questoes = await buscarQuestoesPorIds(questaoIds);

  return {
    ...desafio,
    questoesDetalhadas: questoes,
  };
}

export async function responderDesafio(
  desafioId: string,
  data: {
    userId: string;
    respostas: Array<{
      questaoId: string;
      resposta?: string;
      tempoResposta?: number;
    }>;
  },
) {
  const desafio = await buscarDesafioOuFalhar(desafioId);

  validarParticipanteDesafio(desafio, data.userId);

  if (desafio.expiraEm < new Date()) {
    throw badRequest('Este desafio expirou', 'DESAFIO_EXPIRED');
  }

  const currentResults = (desafio.resultados as ResultadoMap | null) ?? {};

  if (typeof currentResults[data.userId] === 'number') {
    throw badRequest('Este usuario ja respondeu o desafio', 'DESAFIO_ALREADY_ANSWERED');
  }

  const questaoIds = Array.isArray(desafio.questoes) ? (desafio.questoes as string[]) : [];
  const questoes = await buscarQuestoesPorIds(questaoIds);

  let score = 0;
  const seenQuestionIds = new Set<string>();
  const respostasProcessadas = [];

  for (const resposta of data.respostas) {
    if (seenQuestionIds.has(resposta.questaoId)) {
      throw badRequest('Cada questao do desafio deve ser respondida apenas uma vez', 'DESAFIO_DUPLICATE_ANSWER');
    }

    seenQuestionIds.add(resposta.questaoId);
    const questao = questoes.find((item) => item.id === resposta.questaoId);

    if (!questao) {
      throw badRequest('A resposta contem questao que nao faz parte do desafio', 'DESAFIO_INVALID_QUESTION');
    }

    if (resposta.resposta !== undefined && typeof resposta.resposta !== 'string') {
      throw badRequest('Resposta invalida', 'INVALID_QUESTION_ANSWER');
    }

    if (
      resposta.tempoResposta !== undefined &&
      (!Number.isFinite(resposta.tempoResposta) || resposta.tempoResposta < 0)
    ) {
      throw badRequest('tempoResposta invalido', 'INVALID_QUESTION_TIME');
    }

    const normalizedExpected = questao.resposta.trim().toLowerCase();
    const normalizedAnswer = (resposta.resposta || '').trim().toLowerCase();
    const acertou = normalizedExpected === normalizedAnswer;

    if (acertou) {
      score += 1;
    }

    respostasProcessadas.push({
      questaoId: resposta.questaoId,
      acertou,
      resposta: resposta.resposta?.trim() || undefined,
      tempoResposta: resposta.tempoResposta,
    });
  }

  const nextResults: ResultadoMap = {
    ...currentResults,
    [data.userId]: score,
  };

  const answeredUsers = Object.keys(nextResults);
  const completed =
    answeredUsers.includes(desafio.criadorId) && answeredUsers.includes(desafio.convidadoId);

  const opponentId = data.userId === desafio.criadorId ? desafio.convidadoId : desafio.criadorId;
  const respostaOperations = respostasProcessadas.map((resposta) =>
    prisma.respostaQuestao.upsert({
      where: {
        userId_questaoId_desafioId: {
          userId: data.userId,
          questaoId: resposta.questaoId,
          desafioId,
        },
      },
      create: {
        userId: data.userId,
        questaoId: resposta.questaoId,
        desafioId,
        acertou: resposta.acertou,
        resposta: resposta.resposta,
        tempoResposta: resposta.tempoResposta,
      },
      update: {
        acertou: resposta.acertou,
        resposta: resposta.resposta,
        tempoResposta: resposta.tempoResposta,
        createdAt: new Date(),
      },
    }),
  );

  const updatedIndex = respostaOperations.length;
  const transactionResults = await prisma.$transaction([
    ...respostaOperations,
    prisma.desafio.update({
      where: { id: desafioId },
      data: {
        status: completed ? 'concluido' : 'aceito',
        resultados: nextResults,
        concluidoEm: completed ? new Date() : null,
      },
      include: {
        criador: {
          select: { id: true, nome: true, email: true },
        },
        convidado: {
          select: { id: true, nome: true, email: true },
        },
      },
    }),
    prisma.notificacao.create({
      data: {
        userId: opponentId,
        titulo: completed ? 'Desafio concluido' : 'Seu amigo respondeu o desafio',
        mensagem: completed
          ? 'Os resultados do desafio ja estao disponiveis.'
          : 'Chegou sua vez de responder para fechar o ranking.',
        tipo: 'desafio',
        link: `/desafios/${desafioId}`,
      },
    }),
  ]);
  const updated = transactionResults[updatedIndex] as DesafioComParticipantes;

  return {
    ...updated,
    placar: nextResults,
  };
}
