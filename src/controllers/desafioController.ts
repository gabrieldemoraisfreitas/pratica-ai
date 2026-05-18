import { Request, Response } from 'express';
import * as desafioService from '../services/desafioService';
import { asyncHandler, badRequest, notFound } from '../lib/errors';

type Params = {
  id: string;
};

export const createDesafio = asyncHandler(async (req: Request, res: Response) => {
  const { convidadoId, questaoIds, expiraEm } = req.body;

  if (!convidadoId || !Array.isArray(questaoIds) || !questaoIds.length) {
    throw badRequest('Campos obrigatorios: convidadoId, questaoIds[]');
  }

  const desafio = await desafioService.criarDesafio({
    criadorId: req.auth!.userId,
    convidadoId,
    questaoIds,
    expiraEm: expiraEm ? new Date(expiraEm) : undefined,
  });
  res.status(201).json(desafio);
});

export const getDesafio = asyncHandler(async (req: Request<Params>, res: Response) => {
  const desafio = await desafioService.buscarDesafioPorId(req.params.id, req.auth!.userId);

  if (!desafio) {
    throw notFound('Desafio nao encontrado', 'DESAFIO_NOT_FOUND');
  }

  res.json(desafio);
});

export const getDesafioByToken = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token || '');

  if (!token) {
    throw badRequest('token e obrigatorio');
  }

  const desafio = await desafioService.buscarDesafioPorToken(token, req.auth!.userId);

  if (!desafio) {
    throw notFound('Desafio nao encontrado', 'DESAFIO_NOT_FOUND');
  }

  res.json(desafio);
});

export const submitDesafioRespostas = asyncHandler(async (req: Request<Params>, res: Response) => {
  const { respostas } = req.body;

  if (!Array.isArray(respostas)) {
    throw badRequest('Campo obrigatorio: respostas[]');
  }

  const desafio = await desafioService.responderDesafio(req.params.id, {
    userId: req.auth!.userId,
    respostas,
  });
  res.json(desafio);
});
