import { Request, Response } from 'express';
import {
  buscarConversaSalva,
  enviarMensagemAprender,
  listarConversasSalvas,
} from '../services/chatService';
import { asyncHandler, badRequest } from '../lib/errors';

type UserConversationParams = {
  userId: string;
};

type ChatParams = {
  chatId: string;
};

export const listSavedChats = asyncHandler(async (_req: Request<UserConversationParams>, res: Response) => {
  const chats = await listarConversasSalvas(_req.auth!.userId);
  res.json(chats);
});

export const getSavedChat = asyncHandler(async (req: Request<ChatParams>, res: Response) => {
  const chat = await buscarConversaSalva(req.params.chatId, req.auth!.userId);
  res.json(chat);
});

export const createAprenderChat = asyncHandler(async (req: Request, res: Response) => {
  const { chatId, topic, requestTopic, materiaId, messages } = req.body;

  const hasTopic = typeof topic === 'string' && topic.trim().length > 0;
  const hasRequestTopic = typeof requestTopic === 'string' && requestTopic.trim().length > 0;
  const hasMessages = Array.isArray(messages) && messages.length > 0;

  if (!hasTopic && !hasRequestTopic && !hasMessages) {
    throw badRequest('E necessario fornecer "topic" ou "messages" com historico.');
  }

  const response = await enviarMensagemAprender({
    chatId,
    topic,
    requestTopic,
    userId: req.auth?.userId,
    materiaId,
    messages,
  });
  res.json(response);
});
