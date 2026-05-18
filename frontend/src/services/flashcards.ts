import api from './api';
import type { Flashcard, PaginatedResponse } from '../types';

type CreateFlashcardPayload = {
  pergunta: string;
  resposta: string;
  dificuldade?: number;
  materiaId: string;
};

export async function listarPorMateria(materiaId: string) {
  const response = await api.get<PaginatedResponse<Flashcard>>(`/materias/${materiaId}/flashcards`, {
    params: { limit: 100, offset: 0 },
  });
  return response.data.items;
}

export async function listarPendentes() {
  const response = await api.get<Flashcard[]>('/flashcards/review');
  return response.data;
}

export async function listarRevisoesPendentes() {
  return listarPendentes();
}

export async function contarPendentes() {
  const response = await api.get<{ count: number }>('/flashcards/pending-count');
  return response.data.count;
}

export async function obterContagemPendentes() {
  return contarPendentes();
}

export async function criar(payload: CreateFlashcardPayload) {
  const response = await api.post<Flashcard>('/flashcards', payload);
  return response.data;
}

export async function criarFlashcard(payload: CreateFlashcardPayload) {
  return criar(payload);
}

export async function deletar(flashcardId: string) {
  await api.delete(`/flashcards/${flashcardId}`);
}

export async function revisarFlashcard(
  flashcardId: string,
  payload: { acertou: boolean; tempoResposta?: number },
) {
  const response = await api.post<Flashcard>(`/flashcards/${flashcardId}/review`, payload);
  return response.data;
}
