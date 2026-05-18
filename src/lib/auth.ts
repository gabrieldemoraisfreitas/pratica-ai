import { createHmac, timingSafeEqual } from 'crypto';
import { unauthorized } from './errors';

const DEFAULT_TOKEN_TTL_IN_SECONDS = 60 * 60;
const TOKEN_ISSUER = 'domino-app';
const TOKEN_AUDIENCE = 'user';
const ALLOWED_ALGORITHM = 'HS256';
const CLOCK_TOLERANCE_IN_SECONDS = 30;

export type AuthContext = {
  userId: string;
  tokenVersion: number;
};

type AuthTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  tokenVersion: number;
};

type AuthTokenHeader = {
  alg: string;
  typ: string;
};

function getEnvSecret() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
}

export function assertStrongSecret() {
  const secret = getEnvSecret();

  if (!secret) {
    throw new Error('AUTH_SECRET (ou JWT_SECRET) e obrigatorio para iniciar a autenticacao');
  }

  if (secret.length < 32) {
    throw new Error('AUTH_SECRET (ou JWT_SECRET) precisa ter pelo menos 32 caracteres');
  }

  return secret;
}

function getAuthSecret() {
  return assertStrongSecret();
}

function readTokenTtlInSeconds() {
  const rawValue = process.env.JWT_EXPIRES_IN?.trim();

  if (!rawValue) {
    return DEFAULT_TOKEN_TTL_IN_SECONDS;
  }

  const match = rawValue.match(/^(\d+)(s|m|h|d)?$/i);

  if (!match) {
    throw new Error('JWT_EXPIRES_IN deve usar formato simples, como 3600, 60m, 1h ou 1d');
  }

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multiplierMap: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  const ttlInSeconds = amount * multiplierMap[unit];

  if (!Number.isFinite(ttlInSeconds) || ttlInSeconds <= 0) {
    throw new Error('JWT_EXPIRES_IN precisa representar um tempo positivo');
  }

  return ttlInSeconds;
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url<T>(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

function sign(unsignedToken: string) {
  return createHmac('sha256', getAuthSecret()).update(unsignedToken).digest('base64url');
}

function parseTokenHeader(value: string) {
  return fromBase64Url<AuthTokenHeader>(value);
}

function parseTokenPayload(value: string) {
  return fromBase64Url<AuthTokenPayload>(value);
}

function failAuth(message: string, logReason: string): never {
  console.warn(`[auth] ${logReason}`);
  throw unauthorized(message);
}

// Validate auth configuration as soon as this module is loaded.
assertStrongSecret();

export function createAuthToken(userId: string, tokenVersion: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: ALLOWED_ALGORITHM, typ: 'JWT' } satisfies AuthTokenHeader));
  const payload = toBase64Url(JSON.stringify({
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + readTokenTtlInSeconds(),
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    tokenVersion,
  } satisfies AuthTokenPayload));
  const unsignedToken = `${header}.${payload}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

export function verifyAuthToken(token: string): AuthContext {
  const tokenParts = token.split('.');

  if (tokenParts.length !== 3) {
    return failAuth('Token invalido', 'token com quantidade invalida de segmentos');
  }

  const [header, payload, signature] = tokenParts;

  if (!header || !payload || !signature) {
    return failAuth('Token invalido', 'token malformado');
  }

  let parsedHeader: AuthTokenHeader;

  try {
    parsedHeader = parseTokenHeader(header);
  } catch {
    return failAuth('Token invalido', 'header de token invalido');
  }

  if (parsedHeader.alg !== ALLOWED_ALGORITHM || parsedHeader.typ !== 'JWT') {
    return failAuth('Token invalido', 'algoritmo ou tipo de token nao permitido');
  }

  const unsignedToken = `${header}.${payload}`;
  const expectedSignature = sign(unsignedToken);
  const validSignature =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!validSignature) {
    return failAuth('Token invalido', 'assinatura invalida');
  }

  let parsedPayload: AuthTokenPayload;

  try {
    parsedPayload = parseTokenPayload(payload);
  } catch {
    return failAuth('Token invalido', 'payload de token invalido');
  }

  if (
    !parsedPayload.sub ||
    !parsedPayload.exp ||
    !parsedPayload.iat ||
    !parsedPayload.iss ||
    !parsedPayload.aud ||
    typeof parsedPayload.tokenVersion !== 'number'
  ) {
    return failAuth('Token invalido', 'claims obrigatorias ausentes');
  }

  if (!Number.isInteger(parsedPayload.tokenVersion) || parsedPayload.tokenVersion < 0) {
    return failAuth('Token invalido', 'tokenVersion invalido');
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (parsedPayload.iat > nowInSeconds + CLOCK_TOLERANCE_IN_SECONDS) {
    return failAuth('Token invalido', 'token emitido no futuro');
  }

  if (parsedPayload.exp <= parsedPayload.iat) {
    return failAuth('Token invalido', 'expiracao inconsistente');
  }

  if (parsedPayload.exp <= nowInSeconds - CLOCK_TOLERANCE_IN_SECONDS) {
    return failAuth('Sessao expirada', 'token expirado');
  }

  if (parsedPayload.iss !== TOKEN_ISSUER) {
    return failAuth('Token invalido', 'issuer invalido');
  }

  if (parsedPayload.aud !== TOKEN_AUDIENCE) {
    return failAuth('Token invalido', 'audience invalida');
  }

  return {
    userId: parsedPayload.sub,
    tokenVersion: parsedPayload.tokenVersion,
  };
}
