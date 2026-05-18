import axios from 'axios';
import { limparSessao, obterSessaoSalva } from './session';

export const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const session = obterSessaoSalva();

  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      limparSessao();
    }

    return Promise.reject(error);
  },
);

export default api;
