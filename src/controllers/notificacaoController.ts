import { Request, Response } from 'express';
import * as notificacaoService from '../services/notificacaoService';
import { asyncHandler } from '../lib/errors';

type Params = {
  id: string;
};

export const getNotificacoes = asyncHandler(async (req: Request, res: Response) => {
  const notificacoes = await notificacaoService.listarNotificacoes(req.auth!.userId);
  res.json(notificacoes);
});

export const markNotificacaoAsRead = asyncHandler(async (req: Request<Params>, res: Response) => {
  const notificacao = await notificacaoService.marcarComoLida(req.params.id, req.auth!.userId);
  res.json(notificacao);
});
