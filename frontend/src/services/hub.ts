import api from './api';
import type {
  AprenderFlow,
  ChatConversationDetail,
  ChatConversationSummary,
  ConversationHistoryMessage,
  Desafio,
  DesafioDetalhado,
  Notificacao,
} from '../types';

export async function gerarFluxoAprender(payload: {
  chatId?: string;
  topic: string;
  requestTopic?: string;
  materiaId?: string;
  messages?: ConversationHistoryMessage[];
}) {
  try {
    const response = await api.post<Partial<AprenderFlow>>('/chat/aprender', payload);

    if (typeof response.data?.aiReply === 'string' && response.data.aiReply.trim()) {
      return response.data as AprenderFlow;
    }

    console.error('Resposta inesperada de /chat/aprender:', response.data);
    throw new Error('CHAT_APRENDER_EMPTY_REPLY');
  } catch (error) {
    const apiResponse = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: unknown } }).response?.data
      : undefined;

    console.error('Erro em /chat/aprender:', apiResponse);

    throw error;
  }
}

export async function listarConversasSalvas() {
  const response = await api.get<ChatConversationSummary[]>('/chat/conversations');
  return response.data;
}

export async function buscarConversaSalva(chatId: string) {
  const response = await api.get<ChatConversationDetail>(`/chat/conversations/${chatId}`);
  return response.data;
}

export async function salvarRespostaQuestao(payload: {
  questaoId: string;
  acertou: boolean;
  resposta?: string;
  tempoResposta?: number;
}) {
  const response = await api.post('/respostas', payload);
  return response.data;
}

export async function criarDesafio(payload: {
  convidadoId: string;
  questaoIds: string[];
}) {
  const response = await api.post<Desafio>('/desafios', payload);
  return response.data;
}

export async function buscarDesafioPorToken(token: string) {
  const response = await api.get<DesafioDetalhado>('/desafios/convite', {
    params: { token },
  });
  return response.data;
}

export async function responderDesafio(
  desafioId: string,
  payload: {
    respostas: Array<{ questaoId: string; resposta?: string; tempoResposta?: number }>;
  },
) {
  const response = await api.post<DesafioDetalhado>(`/desafios/${desafioId}/respostas`, payload);
  return response.data;
}

export async function listarNotificacoes() {
  const response = await api.get<Notificacao[]>('/notificacoes');
  return response.data;
}

export async function marcarNotificacaoComoLida(id: string) {
  const response = await api.patch<Notificacao>(`/notificacoes/${id}`);
  return response.data;
}

export async function listarUsuarios() {
  const response = await api.get('/users');
  return response.data as Array<{ id: string; nome: string; email: string }>;
}
