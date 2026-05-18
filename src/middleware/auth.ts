import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/auth';
import prisma from '../prisma';
import { unauthorized } from '../lib/errors';

const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 5;
const loginAttemptsByIp = new Map<string, number[]>();

function readBearerToken(req: Request) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function cleanupAttempts(attempts: number[], now: number) {
  return attempts.filter((attemptAt) => now - attemptAt < LOGIN_RATE_LIMIT_WINDOW_MS);
}

function cleanupAllExpiredAttempts(now: number) {
  for (const [ip, attempts] of loginAttemptsByIp.entries()) {
    const recentAttempts = cleanupAttempts(attempts, now);

    if (!recentAttempts.length) {
      loginAttemptsByIp.delete(ip);
      continue;
    }

    loginAttemptsByIp.set(ip, recentAttempts);
  }
}

async function authenticateRequest(token: string) {
  const authContext = verifyAuthToken(token);
  const user = await prisma.user.findUnique({
    where: { id: authContext.userId },
    select: { id: true, tokenVersion: true },
  });

  if (!user) {
    console.warn('[auth] usuario do token nao encontrado');
    throw unauthorized('Autenticacao necessaria');
  }

  // Compare version stored in the token with the current DB value to support lightweight invalidation.
  if (user.tokenVersion !== authContext.tokenVersion) {
    console.warn('[auth] token com versao desatualizada');
    throw unauthorized('Sessao invalida');
  }

  return authContext;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    req.auth = await authenticateRequest(token);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);

  if (!token) {
    return next(unauthorized());
  }

  try {
    req.auth = await authenticateRequest(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  cleanupAllExpiredAttempts(now);

  const clientIp = getClientIp(req);
  const recentAttempts = cleanupAttempts(loginAttemptsByIp.get(clientIp) || [], now);

  if (recentAttempts.length >= LOGIN_RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Muitas tentativas de login. Tente novamente em instantes.',
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
    });
  }

  recentAttempts.push(now);
  loginAttemptsByIp.set(clientIp, recentAttempts);

  // Successful login clears the short-lived in-memory counter for that IP.
  res.once('finish', () => {
    if (res.statusCode < 400) {
      loginAttemptsByIp.delete(clientIp);
      return;
    }

    const updatedAttempts = cleanupAttempts(loginAttemptsByIp.get(clientIp) || [], Date.now());

    if (!updatedAttempts.length) {
      loginAttemptsByIp.delete(clientIp);
      return;
    }

    loginAttemptsByIp.set(clientIp, updatedAttempts);
  });

  next();
}
