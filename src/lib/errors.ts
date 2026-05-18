import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;
  retryable?: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', options?: { retryable?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = options?.retryable;
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST') {
  return new AppError(message, 400, code);
}

export function unauthorized(message = 'Autenticacao necessaria') {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message = 'Voce nao tem permissao para acessar este recurso') {
  return new AppError(message, 403, 'FORBIDDEN');
}

export function notFound(message: string, code = 'NOT_FOUND') {
  return new AppError(message, 404, code);
}

export function conflict(message: string, code = 'CONFLICT') {
  return new AppError(message, 409, code);
}

export function asyncHandler<TRequest extends Request = Request>(
  handler: (req: TRequest, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
