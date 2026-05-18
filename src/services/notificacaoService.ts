import prisma from '../prisma';
import { contarFlashcardsPendentes } from './flashcardServices';
import { notFound } from '../lib/errors';

export async function criarNotificacao(data: {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  link?: string;
}) {
  return prisma.notificacao.create({
    data,
  });
}

export async function sincronizarNotificacaoRevisao(userId: string) {
  const pendingCount = await contarFlashcardsPendentes(userId);

  if (!pendingCount) {
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await prisma.notificacao.findFirst({
    where: {
      userId,
      tipo: 'revisao',
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  if (existing) {
    return;
  }

  await criarNotificacao({
    userId,
    titulo: 'Revisoes pendentes',
    mensagem: `Voce tem ${pendingCount} flashcard(s) para revisar hoje.`,
    tipo: 'revisao',
    link: '/?tab=flashcards',
  });
}

export async function listarNotificacoes(userId: string) {
  await sincronizarNotificacaoRevisao(userId);

  return prisma.notificacao.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

export async function marcarComoLida(id: string, userId: string) {
  const notificacao = await prisma.notificacao.findFirst({
    where: {
      id,
      userId,
    },
    select: { id: true },
  });

  if (!notificacao) {
    throw notFound('Notificacao nao encontrada', 'NOTIFICACAO_NOT_FOUND');
  }

  return prisma.notificacao.update({
    where: { id },
    data: { lida: true },
  });
}
