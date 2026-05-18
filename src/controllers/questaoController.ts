import { Request, Response } from 'express';
import * as questaoService from '../services/questaoService';
import { asyncHandler, badRequest } from '../lib/errors';

export const getQuestoes = asyncHandler(async (req: Request, res: Response) => {
  const materiaId = String(req.query.materiaId || '');

  if (!materiaId) {
    throw badRequest('materiaId e obrigatorio');
  }

  const questoes = await questaoService.listarQuestoes(materiaId, req.auth!.userId);
  res.json(questoes);
});

export const createQuestao = asyncHandler(async (req: Request, res: Response) => {
  const { enunciado, resposta, tipo, materiaId } = req.body;

  if (!enunciado || !resposta || !materiaId) {
    throw badRequest('Campos obrigatorios: enunciado, resposta, materiaId');
  }

  const questao = await questaoService.criarQuestao({
    enunciado,
    resposta,
    tipo,
    materiaId,
    userId: req.auth!.userId,
  });
  res.status(201).json(questao);
});
