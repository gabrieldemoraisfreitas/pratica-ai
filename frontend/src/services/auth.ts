import api from './api';
import { limparSessao, obterSessaoSalva, salvarSessao } from './session';
import type { AuthSession } from '../types';

type AuthPayload = {
  email: string;
  senha: string;
};

type RegisterPayload = AuthPayload & {
  nome?: string | null;
  interests?: string | null;
};

export async function login(payload: AuthPayload) {
  const response = await api.post<AuthSession>('/users/login', payload);
  salvarSessao(response.data);
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await api.post<AuthSession>('/users', payload);
  salvarSessao(response.data);
  return response.data;
}

export function obterSessaoAtual() {
  return obterSessaoSalva();
}

export function obterUsuarioSalvo() {
  return obterSessaoSalva()?.user || null;
}

export function logout() {
  limparSessao();
}
