import { Request, Response } from 'express';
import * as userService from '../services/userServices';
import { asyncHandler, badRequest } from '../lib/errors';

type UserParams = {
  id: string;
};

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await userService.listarUsuarios(req.auth!.userId);
  res.json(users);
});

export const getUserById = asyncHandler(async (req: Request<UserParams>, res: Response) => {
  if (req.params.id !== req.auth!.userId) {
    throw badRequest('Use /users/me para acessar o perfil autenticado', 'USE_ME_ENDPOINT');
  }

  const user = await userService.buscarPerfilAtual(req.auth!.userId);
  res.json(user);
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.buscarPerfilAtual(req.auth!.userId);
  res.json(user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, nome, senha, interests, avatar } = req.body;

    if (
      typeof email !== 'string' ||
      typeof senha !== 'string' ||
      !email.trim() ||
      !senha.trim()
    ) {
      throw badRequest('Campos obrigatorios: email, senha');
    }

    const session = await userService.criarUsuario({
      email: email.trim(),
      nome: typeof nome === 'string' ? nome.trim() : null,
      senha,
      interests: typeof interests === 'string' ? interests : null,
      avatar,
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('[users:createUser]', error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : error);
    throw error;
  }
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;

    if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha.trim()) {
      throw badRequest('Campos obrigatorios: email, senha');
    }

    const session = await userService.validarLogin(email.trim(), senha);
    res.json(session);
  } catch (error) {
    console.error('[users:loginUser]', error);
    throw error;
  }
});

export const updateUser = asyncHandler(async (req: Request<UserParams>, res: Response) => {
  const userId = !req.params.id || req.params.id === 'me' ? req.auth!.userId : req.params.id;

  if (userId !== req.auth!.userId) {
    throw badRequest('Use /users/me para atualizar o perfil autenticado', 'USE_ME_ENDPOINT');
  }

  const user = await userService.atualizarUsuario(userId, req.body);
  res.json(user);
});
