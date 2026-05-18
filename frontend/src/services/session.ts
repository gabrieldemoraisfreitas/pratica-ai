import type { User } from '../types';

const STORAGE_KEY = 'academic-ai:session';

export type StoredSession = {
  token: string;
  user: User;
};

export function salvarSessao(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function obterSessaoSalva() {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function limparSessao() {
  localStorage.removeItem(STORAGE_KEY);
}
