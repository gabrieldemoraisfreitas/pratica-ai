import { Request, Response } from 'express';
import * as flashcardService from '../services/flashcardServices';
import { asyncHandler, badRequest } from '../lib/errors';

type MateriaParams = {
  materiaId: string;
};

type FlashcardParams = {
  id: string;
};

export const getFlashcardsByMateria = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  const flashcards = await flashcardService.buscarFlashcardsPorMateria(req.params.materiaId, req.auth!.userId);
  res.json(flashcards);
});

export const getFlashcardsForReview = asyncHandler(async (req: Request, res: Response) => {
  const flashcards = await flashcardService.buscarFlashcardsPendentes(req.auth!.userId);
  res.json(flashcards);
});

export const getPendingReviewCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await flashcardService.contarFlashcardsPendentes(req.auth!.userId);
  res.json({ count });
});

export const getFlashcardById = asyncHandler(async (req: Request<FlashcardParams>, res: Response) => {
  const flashcard = await flashcardService.buscarFlashcardPorId(req.params.id, req.auth!.userId);
  res.json(flashcard);
});

export const createFlashcard = asyncHandler(async (req: Request, res: Response) => {
  const { pergunta, resposta, dificuldade, materiaId } = req.body;

  if (!pergunta || !resposta || !materiaId) {
    throw badRequest('Campos obrigatorios: pergunta, resposta, materiaId');
  }

  const flashcard = await flashcardService.criarFlashcard({
    pergunta,
    resposta,
    dificuldade,
    materiaId,
    userId: req.auth!.userId,
  });
  res.status(201).json(flashcard);
});

export const reviewFlashcard = asyncHandler(async (req: Request<FlashcardParams>, res: Response) => {
  const { acertou, tempoResposta } = req.body;

  if (typeof acertou !== 'boolean') {
    throw badRequest('Campo obrigatorio: acertou');
  }

  const flashcard = await flashcardService.revisarFlashcard(req.params.id, req.auth!.userId, {
    acertou,
    tempoResposta,
  });
  res.json(flashcard);
});

export const updateFlashcard = asyncHandler(async (req: Request<FlashcardParams>, res: Response) => {
  const flashcard = await flashcardService.atualizarFlashcard(req.params.id, req.auth!.userId, req.body);
  res.json(flashcard);
});

export const deleteFlashcard = asyncHandler(async (req: Request<FlashcardParams>, res: Response) => {
  await flashcardService.deletarFlashcard(req.params.id, req.auth!.userId);
  res.status(204).send();
});
