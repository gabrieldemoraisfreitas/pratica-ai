import { Request, Response } from 'express';
import * as respostaQuestaoService from '../services/respostaQuestaoService';
import { asyncHandler, badRequest } from '../lib/errors';

export const createRespostaQuestao = asyncHandler(async (req: Request, res: Response) => {
  const { questaoId, acertou, resposta, tempoResposta } = req.body;

  if (!questaoId || typeof acertou !== 'boolean') {
    throw badRequest('Campos obrigatorios: questaoId, acertou');
  }

  const created = await respostaQuestaoService.salvarRespostaQuestao({
    userId: req.auth!.userId,
    questaoId,
    acertou,
    resposta,
    tempoResposta,
  });
  res.status(201).json(created);
});
