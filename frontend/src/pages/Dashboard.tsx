import { isAxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { login, logout, obterUsuarioSalvo, register } from '../services/auth';
import { buscarConversaSalva, gerarFluxoAprender, listarConversasSalvas } from '../services/hub';
import { criarMateria, listarMateriasPorUsuario } from '../services/materias';
import { criar as criarFlashcard } from '../services/flashcards';
import FlashcardList from '../components/FlashcardList';
import FlashcardStudyModal from '../components/FlashcardStudyModal';
import MessageRenderer from '../components/MessageRenderer';
import StatsBar from '../components/StatsBar';
import { loginSchema, registerSchema } from '@shared/schemas/user';
import type {
  AprenderFlow,
  ChatConversationSummary,
  ConversationHistoryMessage,
  Materia,
  StoredChatMessage,
  User,
} from '../types';

type Suggestion = {
  label: string;
  value: string;
};

type SendTopicOptions = {
  requestTopic?: string;
};

type ChatMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string; flow: AprenderFlow }
  | { id: string; role: 'error'; content: string; retryTopic: string; requestTopic?: string };

type ActiveView = 'chat' | 'flashcards';

type GuestGate = {
  message: string;
};

type AuthFieldErrors = Partial<Record<'email' | 'senha', string>>;

type FlashcardMeta = {
  materia: string | null;
  materiaId: string | null;
  flashcard: {
    pergunta: string;
    resposta: string;
  } | null;
  loading: boolean;
};

type FlashcardDraft = {
  pergunta: string;
  resposta: string;
  dificuldade: number;
};

const suggestions: Suggestion[] = [
  { label: 'Matemática', value: 'Me explica regra de três' },
  { label: 'Biologia', value: 'Quero revisar fotossíntese' },
  { label: 'Redação ENEM', value: 'Como fazer uma boa introdução no ENEM?' },
  { label: 'Química', value: 'Me explica estequiometria' },
  { label: 'História', value: 'Resumo da Revolução Francesa' },
  { label: 'Física', value: 'O que é aceleração média?' },
  { label: 'Inglês', value: 'Me ajuda com present perfect' },
  { label: 'Geografia', value: 'O que é globalização?' },
];

const fixedExamSubjects = ['Matemática', 'Biologia', 'Química', 'História', 'Física', 'Inglês', 'Geografia', 'Redação ENEM'];

const materiaMap: Record<string, string[]> = {
  Matemática: ['matematica', 'math', 'calculo', 'algebra', 'geometria', 'regra de tres', 'porcentagem', 'funcao'],
  Física: ['fisica', 'mecanica', 'cinematica', 'dinamica', 'forca', 'energia', 'velocidade', 'aceleracao'],
  Química: ['quimica', 'mol', 'atomo', 'molecula', 'acido', 'base', 'ph', 'estequiometria'],
  Biologia: ['biologia', 'celula', 'dna', 'rna', 'genetica', 'ecologia', 'fotossintese', 'mitose'],
  História: ['historia', 'guerra', 'revolucao', 'nazismo', 'fascismo', 'independencia', 'renascimento'],
  Geografia: ['geografia', 'clima', 'bioma', 'populacao', 'globalizacao', 'geopolitica', 'mapa'],
  Inglês: ['ingles', 'english', 'grammar', 'tense', 'vocabulary', 'reading', 'writing'],
  Português: ['portugues', 'redacao', 'enem', 'gramatica', 'sintaxe', 'literatura', 'interpretacao'],
  Filosofia: ['filosofia', 'platao', 'aristoteles', 'kant', 'etica', 'metafisica'],
  Sociologia: ['sociologia', 'marx', 'weber', 'durkheim', 'sociedade', 'desigualdade'],
};

const materiaColors = ['#7F77DD', '#1D9E75', '#D85A30', '#BA7517', '#D4537E', '#378ADD', '#639922'];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function detectMateria(topic: string) {
  const normalizedTopic = normalizeText(topic);

  for (const [materia, keywords] of Object.entries(materiaMap)) {
    if (keywords.some((keyword) => normalizedTopic.includes(normalizeText(keyword)))) {
      return materia;
    }
  }

  return null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    return error.response?.data?.error || fallback;
  }

  return fallback;
}

function getDisplayNameFromEmail(email: string) {
  const local = email.split('@')[0] || email;
  const first = local.split(/[._]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function getUserDisplayName(user: User) {
  return user.nome || getDisplayNameFromEmail(user.email);
}

function getChatErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    console.error('Resposta de erro do chat:', error.response?.data);

    if (error.response?.data?.retryable) {
      return 'A IA ficou indisponivel por um instante.';
    }

    if (error.response?.status === 500) {
      return 'Não foi possível obter resposta. Tente novamente.';
    }
  } else {
    console.error('Erro ao processar resposta do chat:', error);
  }

  return 'Não foi possível obter resposta. Tente novamente.';
}

function getInitials(user: User | null) {
  if (!user) {
    return 'AI';
  }

  return getUserDisplayName(user)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function TypingIndicator() {
  const text = 'pensando...';
  const [visibleText, setVisibleText] = useState('');

  useEffect(() => {
    let index = 0;

    const intervalId = window.setInterval(() => {
      index = index >= text.length ? 1 : index + 1;
      setVisibleText(text.slice(0, index));
    }, 80);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="typing-indicator" id="typing">
      <div className="ai-ava">IA</div>
      <div className="typing-bubble">
        <span className="typing-pulse" aria-hidden="true">{'\u25CF'}</span>
        <span className="typing-copy">{visibleText}</span>
      </div>
    </div>
  );
}

function getAppLayoutStyle(sidebarExpanded: boolean): CSSProperties {
  return {
    ['--sidebar-current-width' as string]: sidebarExpanded ? '220px' : '52px',
  };
}

function mapChatMessagesToConversationHistory(chatMessages: ChatMessage[]): ConversationHistoryMessage[] {
  return chatMessages
    .filter((message): message is Extract<ChatMessage, { role: 'user' | 'assistant' }> =>
      message.role === 'user' || message.role === 'assistant',
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function mapStoredMessagesToChatMessages(storedMessages: StoredChatMessage[]): ChatMessage[] {
  return storedMessages.map((message) => {
    if (message.role === 'assistant' && message.flow) {
      return {
        id: message.id,
        role: 'assistant',
        content: message.content,
        flow: message.flow,
      };
    }

    return {
      id: message.id,
      role: 'user',
      content: message.content,
    };
  });
}

function Dashboard({ initialAuthMode }: { initialAuthMode?: 'login' | 'register' }) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatAreaRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const flashcardMetaRequestRef = useRef(0);
  const savedUser = useMemo(() => obterUsuarioSalvo(), []);

  const [currentUser, setCurrentUser] = useState<User | null>(savedUser);
  const [isGuest, setIsGuest] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [authOpen, setAuthOpen] = useState(!savedUser);
  const [authMode, setAuthMode] = useState<'login' | 'register'>(initialAuthMode || 'login');
  const [authError, setAuthError] = useState('');
  const [authFieldErrors, setAuthFieldErrors] = useState<AuthFieldErrors>({});
  const [authLoading, setAuthLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', senha: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', senha: '' });
  const [topic, setTopic] = useState('');
  const [selectedMateriaId, setSelectedMateriaId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [guestMateriaName, setGuestMateriaName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [flashcardStudyOpen, setFlashcardStudyOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [examPopoverOpen, setExamPopoverOpen] = useState(false);
  const [guestGate, setGuestGate] = useState<GuestGate | null>(null);
  const [showFlashcardPrompt, setShowFlashcardPrompt] = useState(false);
  const [flashcardMeta, setFlashcardMeta] = useState<FlashcardMeta | null>(null);
  const [flashcardModalOpen, setFlashcardModalOpen] = useState(false);
  const [flashcardDraft, setFlashcardDraft] = useState<FlashcardDraft>({
    pergunta: '',
    resposta: '',
    dificuldade: 3,
  });
  const [flashcardSaveLoading, setFlashcardSaveLoading] = useState(false);
  const [flashcardSaveError, setFlashcardSaveError] = useState('');

  const materiasQuery = useQuery({
    queryKey: ['materias', currentUser?.id],
    queryFn: () => listarMateriasPorUsuario(),
    enabled: Boolean(currentUser?.id),
  });

  const savedChatsQuery = useQuery({
    queryKey: ['saved-chats', currentUser?.id],
    queryFn: () => listarConversasSalvas(),
    enabled: Boolean(currentUser?.id),
  });

  const materias = useMemo(() => materiasQuery.data ?? [], [materiasQuery.data]);
  const totalFlashcardsPendentes = useMemo(
    () => materias.reduce((total, materia) => total + (materia.flashcardsPendentes ?? 0), 0),
    [materias],
  );
  const savedChats = useMemo(() => savedChatsQuery.data ?? [], [savedChatsQuery.data]);
  const examSubjects = useMemo(
    () => (materias.length ? materias.map((materia) => materia.nome) : fixedExamSubjects),
    [materias],
  );
  const selectedMateria = materias.find((materia) => materia.id === selectedMateriaId) || null;
  const selectedSavedChat = savedChats.find((chat) => chat.id === selectedConversationId) || null;
  const activeMateriaName = selectedSavedChat?.materia?.nome || selectedMateria?.nome || guestMateriaName;
  const conversationStarted = messages.length > 0;
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const canShowFlashcardPrompt = Boolean(currentUser && activeView === 'chat' && showFlashcardPrompt && flashcardMeta?.flashcard);

  useEffect(() => {
    if (!currentUser) {
      setSelectedConversationId('');
      return;
    }

    if (!selectedConversationId) {
      return;
    }

    if (savedChatsQuery.isLoading || savedChatsQuery.isFetching) {
      return;
    }

    if (!savedChats.length) {
      return;
    }

    if (!savedChats.some((chat) => chat.id === selectedConversationId)) {
      setSelectedConversationId('');
      setMessages([]);
    }
  }, [currentUser, savedChats, savedChatsQuery.isFetching, savedChatsQuery.isLoading, selectedConversationId]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [topic]);

  useEffect(() => {
    const chatArea = chatAreaRef.current;
    const messagesEnd = messagesEndRef.current;

    if (!chatArea) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (messagesEnd) {
        messagesEnd.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return;
      }

      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeView === 'flashcards') {
      setShowFlashcardPrompt(false);
      setFlashcardMeta(null);
    }
  }, [activeView]);

  useEffect(() => {
    if (!flashcardModalOpen || !flashcardMeta?.flashcard) {
      return;
    }

    setFlashcardDraft((current) => ({
      ...current,
      pergunta: current.pergunta || flashcardMeta.flashcard?.pergunta || '',
      resposta: current.resposta || flashcardMeta.flashcard?.resposta || '',
    }));
  }, [flashcardMeta?.flashcard, flashcardModalOpen]);

  function clearFlashcardPrompt() {
    flashcardMetaRequestRef.current += 1;
    setShowFlashcardPrompt(false);
    setFlashcardMeta(null);
  }

  async function resolveMateriaIdFromMeta(materiaNome: string | null) {
    if (!currentUser || !materiaNome) {
      return null;
    }

    const normalizedMateria = normalizeText(materiaNome);
    const currentMaterias =
      queryClient.getQueryData<Materia[]>(['materias', currentUser.id]) ?? materias;
    const existing = currentMaterias.find((materia) => normalizeText(materia.nome) === normalizedMateria);

    if (existing) {
      setSelectedMateriaId(existing.id);
      return existing.id;
    }

    const created = await criarMateria({ nome: materiaNome });
    queryClient.setQueryData<Materia[]>(['materias', currentUser.id], (current = currentMaterias) =>
      [...current, created].sort((a, b) => a.nome.localeCompare(b.nome)),
    );
    setSelectedMateriaId(created.id);
    return created.id;
  }

  async function handleSelectSavedChat(chat: ChatConversationSummary) {
    if (!currentUser || chatListLoading) {
      return;
    }

    setChatListLoading(true);
    setActiveView('chat');
    clearFlashcardPrompt();
    setSelectedConversationId(chat.id);
    setGuestMateriaName('');

    try {
      const response = await buscarConversaSalva(chat.id);
      setMessages(mapStoredMessagesToChatMessages(response.messages));

      if (response.materiaId) {
        setSelectedMateriaId(response.materiaId);
      } else {
        setSelectedMateriaId('');
      }
    } catch (error) {
      setSelectedConversationId('');
      setMessages([]);
      setToast({ message: getErrorMessage(error, 'Não foi possível carregar a conversa salva.'), error: true });
    } finally {
      setChatListLoading(false);
    }
  }

  async function handleCopyMessage(messageId: string, content: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? '' : current));
      }, 1600);
    } catch {
      setToast({ message: 'Nao foi possivel copiar a mensagem.', error: true });
    }
  }

  function clearAuthFieldError(field: keyof AuthFieldErrors) {
    setAuthFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateAuthForm() {
    const result = authMode === 'login'
      ? loginSchema.safeParse(loginForm)
      : registerSchema.safeParse(registerForm);

    if (result.success) {
      setAuthFieldErrors({});
      return true;
    }

    const nextErrors: AuthFieldErrors = {};

    for (const issue of result.error.issues) {
      const field = issue.path[0];

      if (
        typeof field === 'string' &&
        ['email', 'senha'].includes(field) &&
        !nextErrors[field as keyof AuthFieldErrors]
      ) {
        nextErrors[field as keyof AuthFieldErrors] = issue.message;
      }
    }

    setAuthFieldErrors(nextErrors);
    return false;
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateAuthForm()) {
      setAuthError('');
      return;
    }

    setAuthLoading(true);
    setAuthError('');

    try {
      const session =
        authMode === 'login'
          ? await login({ email: loginForm.email.trim(), senha: loginForm.senha })
          : await register({
              email: registerForm.email.trim(),
              senha: registerForm.senha,
              nome: null,
              interests: null,
            });

      setCurrentUser(session.user);
      setIsGuest(false);
      setAuthOpen(false);
      setAuthFieldErrors({});
      setLoginForm({ email: '', senha: '' });
      setRegisterForm({ email: '', senha: '' });
      setToast({
        message: authMode === 'login'
          ? `Bem-vindo, ${getUserDisplayName(session.user)}.`
          : `Conta criada para ${getUserDisplayName(session.user)}.`,
      });
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Não foi possível concluir a autenticação.'));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSendTopic(prefilledTopic?: string, options?: SendTopicOptions) {
    if (chatLoading) {
      return;
    }

    const rawTopic = (prefilledTopic ?? topic).trim();
    const requestTopic = options?.requestTopic?.trim();
    const historicoParaEnviar = mapChatMessagesToConversationHistory(messages);

    if (!rawTopic) {
      return;
    }

    const userMessage: ChatMessage = { id: createId('user'), role: 'user', content: rawTopic };
    setActiveView('chat');
    clearFlashcardPrompt();
    setMessages((current) => [...current, userMessage]);
    setTopic('');
    setChatLoading(true);

    try {
      const detectedMateria = currentUser ? null : detectMateria(rawTopic);
      const materiaId = selectedMateriaId || undefined;

      if (!currentUser && detectedMateria) {
        setGuestMateriaName(detectedMateria);
      }

      const response = await gerarFluxoAprender({
        chatId: currentUser ? selectedConversationId || undefined : undefined,
        topic: rawTopic,
        requestTopic,
        materiaId,
        messages: historicoParaEnviar,
      });

      if (currentUser) {
        setSelectedConversationId(response.chatId || '');
        await queryClient.invalidateQueries({ queryKey: ['saved-chats', currentUser.id] });
        const suggestedFlashcard = response.flashcard
          ? {
              pergunta: response.flashcard.frente,
              resposta: response.flashcard.verso,
            }
          : response.flashcardSuggestion || null;
        const resolvedMateriaId = await resolveMateriaIdFromMeta(response.materia ?? null);

        setFlashcardMeta({
          materia: response.materia ?? null,
          materiaId: resolvedMateriaId,
          flashcard: suggestedFlashcard,
          loading: false,
        });
        setShowFlashcardPrompt(Boolean(suggestedFlashcard));
      }

      setMessages((current) => [
        ...current,
        {
          id: response.storedMessages?.find((message) => message.role === 'assistant')?.id || createId('assistant'),
          role: 'assistant',
          content: response.aiReply,
          flow: response,
        },
      ]);
    } catch (error) {
      setTopic(rawTopic);
      setMessages((current) => [
        ...current.filter((message) => message.id !== userMessage.id),
        {
          id: createId('error'),
          role: 'error',
          content: getChatErrorMessage(error),
          retryTopic: rawTopic,
          requestTopic,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleTopicKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendTopic();
    }
  }

  async function handleSimulateExam(subject: string) {
    if (!currentUser) {
      setExamPopoverOpen(false);
      setGuestGate({
        message: 'O modo Simular Prova está disponível apenas para usuários cadastrados. Crie sua conta grátis para usar.',
      });
      return;
    }

    setExamPopoverOpen(false);
    await handleSendTopic(
      `Simule uma prova com 5 questões estilo ENEM sobre ${subject}. Faça as perguntas uma por vez, espere minha resposta e depois corrija explicando o erro ou acerto.`,
    );
  }

  function openCreateAccountModal() {
    setGuestGate(null);
    setAuthMode('register');
    setAuthError('');
    setAuthOpen(true);
  }

  function handleContinueAsGuest() {
    logout();
    setCurrentUser(null);
    setIsGuest(true);
    setAuthOpen(false);
    setAuthError('');
    clearFlashcardPrompt();
    setFlashcardModalOpen(false);
    setSelectedConversationId('');
    setSelectedMateriaId('');
    setGuestMateriaName('');
    setMessages([]);
    setTopic('');
    setActiveView('chat');
  }

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setIsGuest(false);
    clearFlashcardPrompt();
    setFlashcardModalOpen(false);
    setSelectedConversationId('');
    setSelectedMateriaId('');
    setGuestMateriaName('');
    setMessages([]);
    setTopic('');
    setActiveView('chat');
    setFlashcardStudyOpen(false);
    setAuthMode('login');
    setAuthOpen(true);
    queryClient.removeQueries({ queryKey: ['materias'] });
    queryClient.removeQueries({ queryKey: ['flashcards-pending'] });
    queryClient.removeQueries({ queryKey: ['saved-chats'] });
  }

  function handleNewConversation() {
    setMessages([]);
    setTopic('');
    clearFlashcardPrompt();
    setFlashcardModalOpen(false);
    setSelectedConversationId('');
    setSelectedMateriaId('');
    setGuestMateriaName('');
    setActiveView('chat');
    setExamPopoverOpen(false);
  }

  function openFlashcardStudy() {
    if (!currentUser) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }

    setFlashcardStudyOpen(true);
  }

  function openFlashcardSuggestionModal() {
    setFlashcardDraft({
      pergunta: flashcardMeta?.flashcard?.pergunta || '',
      resposta: flashcardMeta?.flashcard?.resposta || '',
      dificuldade: 3,
    });
    setFlashcardSaveError('');
    setFlashcardModalOpen(true);
  }

  async function handleFlashcardSuggestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!flashcardMeta?.materiaId) {
      return;
    }

    if (!flashcardDraft.pergunta.trim() || !flashcardDraft.resposta.trim()) {
      setFlashcardSaveError('Preencha pergunta e resposta para salvar.');
      return;
    }

    setFlashcardSaveLoading(true);
    setFlashcardSaveError('');

    try {
      const created = await criarFlashcard({
        pergunta: flashcardDraft.pergunta.trim(),
        resposta: flashcardDraft.resposta.trim(),
        dificuldade: flashcardDraft.dificuldade,
        materiaId: flashcardMeta.materiaId,
      });

      setFlashcardModalOpen(false);
      clearFlashcardPrompt();
      setToast({ message: 'Flashcard salvo! ✓' });
      setSelectedMateriaId(created.materiaId);
      setActiveView('flashcards');
      await queryClient.invalidateQueries({ queryKey: ['materia-flashcards', created.materiaId] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards-review'] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards-pending'] });
      await queryClient.invalidateQueries({ queryKey: ['materias'] });
    } catch (error) {
      setFlashcardSaveError(getErrorMessage(error, 'Nao foi possivel salvar o flashcard.'));
    } finally {
      setFlashcardSaveLoading(false);
    }
  }

  function renderSidebarUserArea() {
    if (!sidebarExpanded) {
      return <div className="sidebar-collapsed-user-icon" aria-hidden="true">{currentUser ? getInitials(currentUser) : 'AI'}</div>;
    }

    if (currentUser) {
      const displayName = getUserDisplayName(currentUser);

      return (
        <>
          <div className="user-row">
            {currentUser.avatar ? (
              <img className="user-avatar user-avatar-image" src={currentUser.avatar} alt={displayName} />
            ) : (
              <div className="user-avatar">{getInitials(currentUser)}</div>
            )}
            <div className="user-info">
              <div className="user-name">{displayName}</div>
              <div className="user-role">Estudante</div>
            </div>
          </div>
          <button className="logout-btn" type="button" onClick={handleLogout}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 4V2.5A.5.5 0 0 0 7.5 2h-5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V8" />
              <line x1="5" y1="6" x2="11" y2="6" />
              <polyline points="9,4 11,6 9,8" />
            </svg>
            <span className="logout-label">Sair</span>
          </button>
        </>
      );
    }

    return (
      <button
        className="login-btn login-btn-sidebar"
        type="button"
        onClick={() => {
          setAuthMode('login');
          setAuthOpen(true);
        }}
      >
        Entrar / Criar conta
      </button>
    );
  }

  return (
    <div
      className="app"
      style={getAppLayoutStyle(sidebarExpanded)}
    >
      <aside className={`sidebar${sidebarExpanded ? '' : ' collapsed'}`} id="sidebar">
        <div className="sb-top">
          <div className="sb-logo">AI</div>
          <span className="sb-brandname">Pratica</span>
          <button className="sb-toggle" type="button" onClick={() => setSidebarExpanded((value) => !value)} title="Recolher">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2" y="2" width="10" height="10" rx="2" />
              <line x1="5" y1="2" x2="5" y2="12" />
            </svg>
          </button>
        </div>

        <button className="sb-new" type="button" onClick={handleNewConversation}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
            <line x1="6.5" y1="1" x2="6.5" y2="12" />
            <line x1="1" y1="6.5" x2="12" y2="6.5" />
          </svg>
          <span className="sb-new-label">Nova conversa</span>
        </button>

        <div className="sb-scroll">
          <div className="sb-section">Conversas</div>
          <div id="saved-chats-list">
            {currentUser ? (
              savedChats.length ? (
                savedChats.map((chat, index) => (
                  <button
                    key={chat.id}
                    type="button"
                    className={`materia-item${chat.id === selectedConversationId ? ' active' : ''}`}
                    onClick={() => void handleSelectSavedChat(chat)}
                    disabled={chatListLoading}
                  >
                    <div
                      className="materia-dot"
                      style={{ background: chat.materia?.cor || materiaColors[index % materiaColors.length] }}
                    />
                    <span className="materia-label saved-chat-title">{chat.title}</span>
                  </button>
                ))
              ) : (
                <div className="sidebar-empty">Nenhuma conversa salva ainda</div>
              )
            ) : (
              <div className="sidebar-empty">Entre para salvar conversas com contexto</div>
            )}
          </div>

          <div className="sb-section sidebar-section-title">Matérias</div>
          <div id="materias-list">
            {currentUser ? (
              materias.length ? (
                materias.map((materia, index) => (
                  <button
                    key={materia.id}
                    type="button"
                    className={`materia-item${materia.id === selectedMateriaId ? ' active' : ''}`}
                    onClick={() => setSelectedMateriaId(materia.id)}
                    >
                      <div
                        className="materia-dot"
                        style={{ background: materia.cor || materiaColors[index % materiaColors.length] }}
                      />
                    <span className="materia-label materia-name sidebar-label">{materia.nome}</span>
                    {materia.flashcardsPendentes ? (
                      <span className="notif-badge">{materia.flashcardsPendentes}</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="sidebar-empty">Nenhuma matéria ainda</div>
              )
            ) : (
              <div className="sidebar-empty">Entre para salvar suas matérias</div>
            )}
          </div>

          <div className="sb-tools-section">
            <div className="sb-section sidebar-section-title">Ferramentas</div>
            <button
              className="sb-tool-btn"
              type="button"
              onClick={() => {
                if (!currentUser) {
                  setAuthMode('login');
                  setAuthOpen(true);
                  return;
                }
                if (totalFlashcardsPendentes) {
                  openFlashcardStudy();
                  return;
                }
                setActiveView('flashcards');
              }}
            >
              <svg className="sb-tool-icon" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1.5" y="3" width="12" height="9" rx="1.5" />
                <line x1="4" y1="7" x2="11" y2="7" />
                <line x1="4" y1="10" x2="8" y2="10" />
              </svg>
              <span className="sb-tool-label sidebar-label">Flashcards</span>
              {currentUser && totalFlashcardsPendentes ? <span className="notif-badge">{totalFlashcardsPendentes}</span> : null}
            </button>
            <button className="sb-tool-btn" type="button" onClick={() => setToast({ message: 'Use as questões práticas abaixo de cada resposta.' })}>
              <svg className="sb-tool-icon" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7.5" cy="7.5" r="5.5" />
                <path d="M7.5 5v2.5l2 2" />
              </svg>
              <span className="sb-tool-label sidebar-label">Desafios</span>
            </button>
          </div>
        </div>

        <div className="sb-bottom">{renderSidebarUserArea()}</div>
      </aside>

      <main className="main" id="main">
        <div className="topbar" id="topbar">
          <div className="topbar-left">
            <div className="topbar-title" id="topbar-title">
              {selectedSavedChat?.title || (
                conversationStarted
                  ? lastUserMessage?.content && lastUserMessage.content.length > 50
                    ? `${lastUserMessage.content.slice(0, 47)}...`
                    : lastUserMessage?.content
                  : 'Qual seu objetivo de estudo hoje?'
              )}
            </div>
            <div className="topbar-sub" id="topbar-sub">
              {conversationStarted
                ? activeMateriaName
                  ? `${activeMateriaName} · agora`
                  : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''}
            </div>
          </div>
          <div className="topbar-right" id="topbar-right">
            {activeMateriaName ? (
              <span className="materia-pill">{activeMateriaName}</span>
            ) : null}
          </div>
        </div>

        <div id="content-area" className="content-area">
          {activeView === 'flashcards' ? (
            <FlashcardList
              materias={materias}
              selectedMateriaId={selectedMateriaId}
              onSelectMateria={setSelectedMateriaId}
              onClose={() => setActiveView('chat')}
              onStartReview={openFlashcardStudy}
            />
          ) : !conversationStarted ? (
            <div className="empty-state" id="empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <div className="empty-title">
                {!currentUser && !isGuest ? 'Entre ou continue como visitante' : 'O que vamos estudar hoje?'}
              </div>
              <div className="empty-sub">
                {!currentUser && !isGuest
                  ? 'O modal de login já está pronto para entrar, criar conta ou continuar como visitante.'
                  : 'Escreva uma dúvida ou escolha um tema abaixo. A matéria será detectada automaticamente quando fizer sentido.'}
              </div>
              {currentUser ? (
                <StatsBar
                  materiasCount={materias.length}
                  revisoesPendentesCount={totalFlashcardsPendentes}
                  conversasCount={savedChats.length}
                  onStartFlashcardStudy={openFlashcardStudy}
                />
              ) : null}
              <div className="chips-row">
                {suggestions.map((suggestion) => (
                  <button key={suggestion.value} className="chip" type="button" onClick={() => void handleSendTopic(suggestion.value)}>
                    {suggestion.label}
                  </button>
                ))}
              </div>
              {!currentUser ? (
                <div className="guest-mode-banner">
                  <span className="guest-mode-icon" aria-hidden="true">🔒</span>
                  <span>
                    Você está no modo visitante. Suas conversas não serão salvas.{' '}
                    <button className="guest-mode-link" type="button" onClick={openCreateAccountModal}>
                      Crie uma conta
                    </button>{' '}
                    para salvar histórico, flashcards e simular provas.
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="chat-area" id="chat-area" ref={chatAreaRef}>
              {messages.map((message) => {
                if (message.role === 'user') {
                  return (
                    <div key={message.id} className="msg-user">
                      <div className="msg-user-bubble">
                        <div>{message.content}</div>
                        <button
                          className="msg-copy-btn"
                          type="button"
                          onClick={() => void handleCopyMessage(message.id, message.content)}
                          title="Copiar mensagem"
                          aria-label="Copiar mensagem"
                        >
                          {copiedMessageId === message.id ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  );
                }

                if (message.role === 'error') {
                  return (
                    <div key={message.id} className="msg-error">
                      <div className="msg-error-content">
                        <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="7.5" cy="7.5" r="5.5" />
                          <line x1="7.5" y1="5" x2="7.5" y2="7.5" />
                          <circle cx="7.5" cy="9.5" r=".5" fill="currentColor" />
                        </svg>
                        <span>{message.content}</span>
                      </div>
                      <div className="msg-error-actions">
                        <button
                          className="msg-copy-btn"
                          type="button"
                          onClick={() => void handleCopyMessage(message.id, message.content)}
                          title="Copiar mensagem"
                          aria-label="Copiar mensagem"
                        >
                          {copiedMessageId === message.id ? 'Copiado' : 'Copiar'}
                        </button>
                        <button
                          className="msg-error-retry"
                          type="button"
                          onClick={() => void handleSendTopic(message.retryTopic, { requestTopic: message.requestTopic })}
                          disabled={chatLoading}
                        >
                          Tentar novamente
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="msg-ai">
                    <div className="ai-ava">IA</div>
                    <div className="ai-body">
                      <div className="ai-bubble">
                        <MessageRenderer content={message.content} />
                        {message.flow.applicationPrompt ? <div className="reflection">Tente aplicar agora</div> : null}
                        <button
                          className="msg-copy-btn"
                          type="button"
                          onClick={() => void handleCopyMessage(message.id, message.content)}
                          title="Copiar mensagem"
                          aria-label="Copiar mensagem"
                        >
                          {copiedMessageId === message.id ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {chatLoading ? <TypingIndicator /> : null}
              <div ref={messagesEndRef} className="chat-end-anchor" aria-hidden="true" />
            </div>
          )}
        </div>

        {canShowFlashcardPrompt ? (
          <button
            className={`flashcard-prompt-fab${flashcardMeta?.loading ? ' loading' : ''}`}
            type="button"
            onClick={openFlashcardSuggestionModal}
            title="Criar flashcard"
          >
            <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="1.5" y="3" width="12" height="9" rx="1.5" />
              <line x1="4" y1="7" x2="11" y2="7" />
              <line x1="4" y1="10" x2="8" y2="10" />
            </svg>
            <span>{flashcardMeta?.loading ? 'Preparando flashcard' : 'Criar flashcard'}</span>
          </button>
        ) : null}

        <div className="input-area" id="input-area">
          {activeMateriaName && conversationStarted ? (
            <div className="input-context-row" id="input-ctx-row">
              <div className="ctx-dot" />
              <span className="ctx-text" id="input-ctx-text">
                Conversando em {activeMateriaName}
              </span>
            </div>
          ) : null}

          <div className="input-box">
            <div className="exam-sim-wrapper">
              <button
                className="exam-sim-btn"
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    setExamPopoverOpen(false);
                    setGuestGate({
                      message: 'O modo Simular Prova está disponível apenas para usuários cadastrados. Crie sua conta grátis para usar.',
                    });
                    return;
                  }

                  setExamPopoverOpen((current) => !current);
                }}
                disabled={chatLoading}
                title="Simular Prova"
              >
                <span aria-hidden="true">📝</span>
                <span>Simular Prova</span>
              </button>
              {examPopoverOpen ? (
                <div className="exam-sim-popover">
                  {examSubjects.map((subject) => (
                    <button
                      key={subject}
                      className="exam-sim-option"
                      type="button"
                      onClick={() => void handleSimulateExam(subject)}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={handleTopicKeyDown}
              rows={1}
              placeholder="Digite sua dúvida ou tópico de estudo..."
              disabled={chatLoading}
            />
            <button
              className="send-btn"
              id="send-btn"
              type="button"
              onClick={() => void handleSendTopic()}
              disabled={chatLoading || !topic.trim()}
              title="Enviar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.8">
                <line x1="2" y1="7" x2="12" y2="7" />
                <polyline points="8,3 12,7 8,11" />
              </svg>
            </button>
          </div>
          <div className="input-hint">Enter envia. Shift+Enter quebra a linha. A IA pode cometer erros.</div>
        </div>
      </main>

      <div className={`modal-overlay${authOpen ? ' open' : ''}`} id="auth-modal" onClick={() => setAuthOpen(false)}>
        <div className="modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head">
            <div>
              <div className="modal-title">Bem-vindo</div>
              <div className="modal-sub">Entre para salvar seu progresso</div>
            </div>
            <button className="modal-close" type="button" onClick={() => setAuthOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="2" y1="2" x2="12" y2="12" />
                <line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          </div>

          <div className="modal-tabs">
            <button className={`modal-tab${authMode === 'login' ? ' active' : ''}`} type="button" onClick={() => { setAuthMode('login'); setAuthError(''); setAuthFieldErrors({}); }}>
              Entrar
            </button>
            <button className={`modal-tab${authMode === 'register' ? ' active' : ''}`} type="button" onClick={() => { setAuthMode('register'); setAuthError(''); setAuthFieldErrors({}); }}>
              Criar conta
            </button>
          </div>

          {authError ? <div className="modal-error show">{authError}</div> : <div className="modal-error" />}

          <form onSubmit={(event) => void handleAuthSubmit(event)}>
            {authMode === 'login' ? (
              <div>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">E-mail</label>
                  <input
                    id="login-email"
                    className="form-input"
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => {
                      clearAuthFieldError('email');
                      setLoginForm((current) => ({ ...current, email: event.target.value }));
                    }}
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                  {authFieldErrors.email ? <div className="field-error">{authFieldErrors.email}</div> : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-senha">Senha</label>
                  <input
                    id="login-senha"
                    className="form-input"
                    type="password"
                    value={loginForm.senha}
                    onChange={(event) => {
                      clearAuthFieldError('senha');
                      setLoginForm((current) => ({ ...current, senha: event.target.value }));
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  {authFieldErrors.senha ? <div className="field-error">{authFieldErrors.senha}</div> : null}
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-email">E-mail</label>
                  <input
                    id="reg-email"
                    className="form-input"
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => {
                      clearAuthFieldError('email');
                      setRegisterForm((current) => ({ ...current, email: event.target.value }));
                    }}
                    placeholder="seu@email.com"
                    autoComplete="email"
                  />
                  {authFieldErrors.email ? <div className="field-error">{authFieldErrors.email}</div> : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-senha">Senha</label>
                  <input
                    id="reg-senha"
                    className="form-input"
                    type="password"
                    value={registerForm.senha}
                    onChange={(event) => {
                      clearAuthFieldError('senha');
                      setRegisterForm((current) => ({ ...current, senha: event.target.value }));
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {authFieldErrors.senha ? <div className="field-error">{authFieldErrors.senha}</div> : null}
                </div>
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={authLoading}>
              {authLoading ? (authMode === 'login' ? 'Entrando...' : 'Criando...') : authMode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
            <div className="or-divider">ou</div>
            <button className="btn-visitor" type="button" onClick={handleContinueAsGuest}>
              Continuar como visitante
            </button>
          </form>
        </div>
      </div>

      <div className={`modal-overlay${guestGate ? ' open' : ''}`} onClick={() => setGuestGate(null)}>
        <div className="guest-gate-modal" onClick={(event) => event.stopPropagation()}>
          <p>{guestGate?.message}</p>
          <button className="btn-primary" type="button" onClick={openCreateAccountModal}>
            Criar conta
          </button>
        </div>
      </div>

      <div className={`modal-overlay${flashcardModalOpen ? ' open' : ''}`} onClick={() => setFlashcardModalOpen(false)}>
        <form
          className="flashcards-modal flashcard-suggestion-modal"
          onSubmit={(event) => void handleFlashcardSuggestionSubmit(event)}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flashcards-modal-head">
            <div>
              <h3>Novo Flashcard</h3>
              <p>Matéria: {flashcardMeta?.materia || 'detectando...'}</p>
            </div>
            <button className="flashcards-icon-btn" type="button" onClick={() => setFlashcardModalOpen(false)}>
              Cancelar
            </button>
          </div>

          {!flashcardMeta?.materiaId ? (
            <div className="flashcards-form-error">
              {flashcardMeta?.loading ? 'Detectando matéria do flashcard...' : 'Não foi possível detectar a matéria para salvar.'}
            </div>
          ) : null}
          {flashcardSaveError ? <div className="flashcards-form-error">{flashcardSaveError}</div> : null}

          <label className="flashcards-label" htmlFor="suggested-flashcard-question">
            Pergunta
          </label>
          <textarea
            id="suggested-flashcard-question"
            className="flashcards-textarea"
            value={flashcardDraft.pergunta}
            onChange={(event) => {
              setFlashcardSaveError('');
              setFlashcardDraft((current) => ({ ...current, pergunta: event.target.value }));
            }}
            rows={3}
          />

          <label className="flashcards-label" htmlFor="suggested-flashcard-answer">
            Resposta
          </label>
          <textarea
            id="suggested-flashcard-answer"
            className="flashcards-textarea"
            value={flashcardDraft.resposta}
            onChange={(event) => {
              setFlashcardSaveError('');
              setFlashcardDraft((current) => ({ ...current, resposta: event.target.value }));
            }}
            rows={4}
          />

          <label className="flashcards-label" htmlFor="suggested-flashcard-difficulty">
            Dificuldade
          </label>
          <select
            id="suggested-flashcard-difficulty"
            className="flashcards-select"
            value={flashcardDraft.dificuldade}
            onChange={(event) =>
              setFlashcardDraft((current) => ({ ...current, dificuldade: Number(event.target.value) }))
            }
          >
            <option value={1}>Fácil</option>
            <option value={3}>Médio</option>
            <option value={5}>Difícil</option>
          </select>

          <div className="flashcard-suggestion-actions">
            <button className="flashcards-secondary" type="button" onClick={() => setFlashcardModalOpen(false)}>
              Cancelar
            </button>
            <button
              className="flashcards-primary"
              type="submit"
              disabled={
                flashcardSaveLoading ||
                !flashcardMeta?.materiaId ||
                !flashcardDraft.pergunta.trim() ||
                !flashcardDraft.resposta.trim()
              }
            >
              {flashcardSaveLoading ? 'Salvando...' : 'Salvar flashcard'}
            </button>
          </div>
        </form>
      </div>

      <FlashcardStudyModal open={flashcardStudyOpen} onClose={() => setFlashcardStudyOpen(false)} />

      {toast ? <div className={`toast${toast.error ? ' error' : ''}`}>{toast.message}</div> : null}
    </div>
  );
}

export default Dashboard;
