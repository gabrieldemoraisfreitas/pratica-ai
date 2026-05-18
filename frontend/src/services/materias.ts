import api from './api';
import type { Flashcard, Materia, PaginatedResponse, Questao } from '../types';

type CreateMateriaPayload = {
  nome: string;
  descricao?: string;
  cor?: string;
};

export async function listarMateriasPorUsuario() {
  const response = await api.get<Materia[]>('/materias');
  return response.data;
}

export async function criarMateria(payload: CreateMateriaPayload) {
  const response = await api.post<Materia>('/materias', payload);
  return response.data;
}

export async function listarFlashcardsDaMateria(materiaId: string, params?: { limit?: number; offset?: number }) {
  const response = await api.get<PaginatedResponse<Flashcard>>(`/materias/${materiaId}/flashcards`, { params });
  return response.data;
}

export async function listarQuestoesDaMateria(materiaId: string, params?: { limit?: number; offset?: number }) {
  const response = await api.get<PaginatedResponse<Questao>>(`/materias/${materiaId}/questoes`, { params });
  return response.data;
}
