export interface User {
  id: string;
  email: string;
  nome: string | null;
  interests?: string | null;
  avatar?: string | null;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface Revisao {
  id: string;
  acertou: boolean;
  tempoResposta?: number | null;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  pergunta: string;
  resposta: string;
  dificuldade?: number | null;
  materiaId: string;
  nextReview: string;
  reviewInterval: number;
  lastReviewedAt?: string | null;
  revisoes?: Revisao[];
  materia?: Materia;
  createdAt?: string;
}

export interface RespostaQuestao {
  id: string;
  userId: string;
  questaoId: string;
  acertou: boolean;
  resposta?: string | null;
  tempoResposta?: number | null;
  createdAt: string;
}

export interface Questao {
  id: string;
  enunciado: string;
  resposta: string;
  tipo?: string | null;
  materiaId: string;
  respostas?: RespostaQuestao[];
  createdAt?: string;
}

export interface Materia {
  id: string;
  nome: string;
  descricao?: string | null;
  cor?: string | null;
  userId?: string;
  icone?: string | null;
  criadoEm?: string | null;
  _count?: {
    flashcards: number;
    questoes: number;
    conversas: number;
  };
  flashcardsPendentes?: number;
  flashcards?: Flashcard[];
  questoes?: Questao[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Notificacao {
  id: string;
  userId: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  tipo: string;
  link?: string | null;
  createdAt: string;
}

export interface Desafio {
  id: string;
  token: string;
  criadorId: string;
  convidadoId: string;
  status: string;
  questoes: string[];
  resultados?: Record<string, number> | null;
  expiraEm: string;
  createdAt: string;
}

export interface DesafioDetalhado extends Desafio {
  criador: Pick<User, 'id' | 'nome' | 'email'>;
  convidado: Pick<User, 'id' | 'nome' | 'email'>;
  questoesDetalhadas: Questao[];
  placar?: Record<string, number>;
}

export interface AprenderFlow {
  aiReply: string;
  resposta?: string;
  materia?: string | null;
  flashcard?: {
    frente: string;
    verso: string;
  } | null;
  activationPrompt?: string | null;
  explanation?: string | null;
  interests?: string[] | null;
  deliberatePractice?: {
    focus: string;
    questions: Questao[];
  } | null;
  applicationPrompt?: string | null;
  flashcardSuggestion?: {
    pergunta: string;
    resposta: string;
  } | null;
  chatId?: string | null;
  history?: ConversationHistoryMessage[];
  storedMessages?: StoredChatMessage[];
}

export interface ConversationHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  flow?: AprenderFlow | null;
  createdAt: string;
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  userId: string;
  materiaId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  _count: {
    messages: number;
  };
  materia?: Pick<Materia, 'id' | 'nome' | 'cor'> | null;
}

export interface ChatConversationDetail {
  id: string;
  title: string;
  userId: string;
  materiaId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  materia?: Pick<Materia, 'id' | 'nome' | 'cor'> | null;
  messages: StoredChatMessage[];
  history: ConversationHistoryMessage[];
}
