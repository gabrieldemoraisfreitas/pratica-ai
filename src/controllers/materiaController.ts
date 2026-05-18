import { Request, Response } from 'express';
import * as materiaService from '../services/materiaService';
import { asyncHandler, badRequest } from '../lib/errors';

type UserParams = {
  userId: string;
};

type MateriaParams = {
  id: string;
};

function parsePagination(query: Request['query']) {
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  const offset = query.offset === undefined ? undefined : Number(query.offset);

  return { limit, offset };
}

export const getMateriasByUser = asyncHandler(async (_req: Request<UserParams>, res: Response) => {
  const materias = await materiaService.buscarMateriasPorUsuario(_req.auth!.userId);
  res.json(materias);
});

export const getMateriaById = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  const materia = await materiaService.buscarMateriaDoUsuario(req.params.id, req.auth!.userId);
  res.json(materia);
});

export const getMateriaFlashcards = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  const flashcards = await materiaService.listarFlashcardsDaMateria(
    req.params.id,
    req.auth!.userId,
    parsePagination(req.query),
  );
  res.json(flashcards);
});

export const getMateriaQuestoes = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  const questoes = await materiaService.listarQuestoesDaMateria(
    req.params.id,
    req.auth!.userId,
    parsePagination(req.query),
  );
  res.json(questoes);
});

export const createMateria = asyncHandler(async (req: Request, res: Response) => {
  const { nome, descricao, cor } = req.body;

  if (!nome) {
    throw badRequest('Campo obrigatorio: nome');
  }

  const materia = await materiaService.criarMateria({
    nome,
    userId: req.auth!.userId,
    descricao,
    cor,
  });
  res.status(201).json(materia);
});

export const updateMateria = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  const materia = await materiaService.atualizarMateria(req.params.id, req.auth!.userId, req.body);
  res.json(materia);
});

export const deleteMateria = asyncHandler(async (req: Request<MateriaParams>, res: Response) => {
  await materiaService.deletarMateria(req.params.id, req.auth!.userId);
  res.status(204).send();
});
