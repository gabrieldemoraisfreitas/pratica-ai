import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Rota nao encontrada', 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...(error.retryable !== undefined ? { retryable: error.retryable } : {}),
    });
  }

  console.error(error);

  return res.status(500).json({
    error: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
  });
}
