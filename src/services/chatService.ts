import prisma from '../prisma';
import { AppError, badRequest, notFound } from '../lib/errors';
import { aiChatMetadataSchema, chatMateriaOptions } from '../../shared/schemas/chat';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_TIMEOUT_MS = 30000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const OPENROUTER_MODEL_RETRY_DELAY_MS = 1000;
const DEFAULT_OPENROUTER_MODELS = [
  'arcee-ai/trinity-large-thinking:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'inclusionai/ring-2.6-1t:free',
  'baidu/cobuddy:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'poolside/laguna-xs.2:free',
  'poolside/laguna-m.1:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m2.5:free',
] as const;
const AI_METADATA_JSON_START = '---JSON---';
const AI_METADATA_JSON_END = '---FIM---';

export type OpenRouterMessageRole = 'user' | 'assistant' | 'system';

export type ConversationHistoryMessage = {
  role: OpenRouterMessageRole;
  content: string;
};

type StoredChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  flow?: unknown;
  createdAt: Date;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenRouterCompletion = {
  text: string;
  model: string;
};

type ParsedLearningResponse = {
  tutorText: string;
  materia: (typeof chatMateriaOptions)[number] | null;
  flashcard: {
    frente: string;
    verso: string;
  } | null;
};

function getOpenRouterModels() {
  const configuredModels = process.env.FALLBACK_MODELS
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return configuredModels?.length ? configuredModels : [...DEFAULT_OPENROUTER_MODELS];
}

function parseInterests(interests?: string | null) {
  return (interests || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildExample(topic: string, interests: string[]) {
  if (!interests.length) {
    return `Pense em ${topic} como um conceito que pode ser observado em uma situacao real do seu dia a dia.`;
  }

  return `Usando ${interests[0]} como gancho: imagine ${topic} aplicado dentro desse universo para visualizar o conceito em acao.`;
}

function buildExplanation(topic: string, interests: string[]) {
  const direct = `Explicacao objetiva: ${topic} envolve identificar a regra principal, reconhecer o padrao e aplicar a ideia com passos curtos e verificaveis.`;
  return interests.length ? `${direct} Exemplo contextual: ${buildExample(topic, interests)}` : direct;
}

function isLikelyFollowUpMessage(topic: string, history: ConversationHistoryMessage[]) {
  const normalizedTopic = topic.trim();

  if (!normalizedTopic) {
    return false;
  }

  const priorUserMessages = history.filter((message) => message.role === 'user');

  if (!priorUserMessages.length) {
    return false;
  }

  const wordCount = normalizedTopic.split(/\s+/).filter(Boolean).length;
  const lowerTopic = normalizedTopic.toLowerCase();
  const followUpMarkers = [
    'respondendo',
    'acho que',
    'entao',
    'então',
    'seria',
    'porque',
    'por que',
    'tipo',
    'nao',
    'não',
    'sim',
    'isso',
    'eles',
    'elas',
    'ele',
    'ela',
  ];

  return wordCount <= 12 || followUpMarkers.some((marker) => lowerTopic.includes(marker));
}

function buildSystemPrompt(data: {
  topic: string;
  requestTopic?: string;
  userName?: string | null;
  interests: string[];
  latestErrorQuestion?: string | null;
  includeMetadata: boolean;
}) {
  const interestsText = data.interests.length
    ? `Interesses do aluno: ${data.interests.join(', ')}.`
    : 'Interesses do aluno nao informados.';

  const latestErrorText = data.latestErrorQuestion
    ? `Ultimo erro relevante do aluno: ${data.latestErrorQuestion}.`
    : 'Nao ha erro recente registrado para esse topico.';

  const metadataInstructions = data.includeMetadata
    ? [
        'A resposta deve ter duas partes: primeiro a explicacao normal do tutor em texto livre; depois, obrigatoriamente, um bloco JSON final.',
        `A parte textual vem antes do delimitador ${AI_METADATA_JSON_START}.`,
        `O bloco JSON vem entre ${AI_METADATA_JSON_START} e ${AI_METADATA_JSON_END}.`,
        'O JSON deve ser valido, sem markdown, sem comentarios e sem texto extra dentro do bloco.',
        `Formato exato do final da resposta: ${AI_METADATA_JSON_START} { "materia": "Nome da materia ou null", "flashcard": { "frente": "Pergunta objetiva sobre o conceito", "verso": "Resposta clara e direta" } } ${AI_METADATA_JSON_END}.`,
        `materia deve ser uma destas opcoes: ${chatMateriaOptions.join(', ')}, ou null se nao identificar.`,
        'flashcard.frente e flashcard.verso devem ser strings curtas e objetivas.',
      ]
    : [
        'Responda somente em texto livre para o aluno.',
        `Nunca inclua JSON, ${AI_METADATA_JSON_START}, ${AI_METADATA_JSON_END}, materia ou flashcard na resposta.`,
      ];

  return [
    'IDENTIDADE: Voce e um tutor academico inteligente, amigavel, direto e paciente.',
    'Independentemente do modelo ou API usada, siga sempre o formato obrigatorio de resposta abaixo.',
    data.requestTopic
      ? `Siga esta solicitacao do aluno: ${data.requestTopic}.`
      : `Ajude o aluno em portugues do Brasil sobre o tema "${data.topic}".`,
    data.userName ? `Nome do aluno: ${data.userName}.` : 'Nome do aluno nao informado.',
    interestsText,
    latestErrorText,
    'Considere todo o historico enviado para manter contexto entre mensagens.',
    ...metadataInstructions,
    'Nao repita o pedido do aluno como titulo, cabecalho ou pergunta reformulada antes de responder.',
    'Toda resposta de ensino deve seguir exatamente esta ordem:',
    '1. Conceito central - 2 a 4 linhas, linguagem simples, sem jargao desnecessario.',
    '2. Formula ou regra, se houver - explique cada parte da formula ou regra.',
    '3. Exemplo resolvido passo a passo - numerado, claro, sem pular etapas.',
    '4. Aplicacao ou contexto real - diga onde isso aparece na vida, nos estudos ou em provas.',
    '5. 1 pergunta de fixacao - faca somente uma pergunta para o aluno refletir.',
    'Para matematica e formulas, nunca use LaTeX puro nem barras invertidas como \\frac, \\sqrt, \\begin ou delimitadores \\[ \\].',
    'Use texto plano: x = (-b ± √Δ) / 2a; Δ = b² - 4ac; fracoes como (numerador) / (denominador).',
    'Use expoentes como ², ³, ^2 ou ^3, e raiz quadrada como √.',
    'Se o aluno errar, corrija com encorajamento, nunca com critica.',
    'Use "voce" e fale no presente.',
    'Perguntas simples devem ter ate 150 palavras; perguntas de conceito ou ensino devem ter 150 a 400 palavras.',
    'Nunca ultrapasse 500 palavras a menos que o aluno peca mais detalhes.',
    'Nunca faca mais de uma pergunta no final.',
  ].join(' ');
}

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY;
}

function getOpenRouterReferer() {
  return process.env.OPENROUTER_REFERER || process.env.APP_URL || 'http://localhost:3001';
}

function getOpenRouterTitle() {
  return process.env.OPENROUTER_TITLE || 'Pratica';
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeConversationHistory(messages?: ConversationHistoryMessage[] | null) {
  return (messages || [])
    .filter((message): message is ConversationHistoryMessage =>
      Boolean(
        message &&
        typeof message.content === 'string' &&
        typeof message.role === 'string' &&
        ['user', 'assistant', 'system'].includes(message.role),
      ),
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-MAX_HISTORY_MESSAGES);
}

function gerenciarJanelaDeTokens(messages: ConversationHistoryMessage[], maxTokens: number) {
  const estimarTokens = (currentMessages: ConversationHistoryMessage[]) =>
    Math.ceil(JSON.stringify(currentMessages).length / 4);

  const nextMessages = [...messages];
  let tokensAtuais = estimarTokens(nextMessages);

  while (tokensAtuais > maxTokens && nextMessages.length > 2) {
    const systemMessage = nextMessages.find((message) => message.role === 'system');
    const nonSystemMessages = nextMessages.filter((message) => message.role !== 'system');

    if (!nonSystemMessages.length) {
      break;
    }

    nonSystemMessages.shift();

    nextMessages.length = 0;

    if (systemMessage) {
      nextMessages.push(systemMessage);
    }

    nextMessages.push(...nonSystemMessages);
    tokensAtuais = estimarTokens(nextMessages);
  }

  return nextMessages;
}

function buildConversationTitle(topic: string) {
  return buildSmartConversationTitle(topic);
}

function normalizeTitleSource(value: string) {
  return value
    .replace(/[#*_`>[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSmartConversationTitle(topic: string, aiReply?: string) {
  const source = normalizeTitleSource(topic) || normalizeTitleSource(aiReply || '');

  if (!source) {
    return 'Nova conversa';
  }

  const cleaned = source
    .replace(/^(me explica|me explique|quero revisar|quero entender|como fazer|como funciona|o que e|o que significa|me ajuda com)\s+/i, '')
    .replace(/[?!.:,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);
  const stopwords = new Set([
    'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'para', 'por', 'com', 'um', 'uma', 'no', 'na',
    'nos', 'nas', 'que', 'como', 'sobre', 'me', 'quero', 'ajuda', 'explica', 'explique', 'entender', 'revisar',
  ]);

  const meaningfulWords = words.filter((word) => !stopwords.has(word.toLowerCase()));
  const baseWords = (meaningfulWords.length ? meaningfulWords : words).slice(0, 6);
  const compactTitle = baseWords.join(' ').trim();
  const fallbackTitle = cleaned || source;
  const finalTitle = compactTitle || fallbackTitle;

  return finalTitle.length > 42 ? `${finalTitle.slice(0, 39).trimEnd()}...` : finalTitle;
}

async function perguntarIAOpenRouterCompletion(messages: ConversationHistoryMessage[]): Promise<OpenRouterCompletion> {
  const openRouterApiKey = getOpenRouterApiKey();
  const openRouterModels = getOpenRouterModels();

  if (!openRouterApiKey) {
    throw new AppError('O servico de IA nao esta configurado no backend.', 503, 'AI_NOT_CONFIGURED');
  }

  let failures = 0;

  for (const [modelIndex, model] of openRouterModels.entries()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
    const hasNextModel = modelIndex < openRouterModels.length - 1;

    try {
      console.info(`[OpenRouter] Tentando modelo gratuito: ${model}`);

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': getOpenRouterReferer(),
          'X-Title': getOpenRouterTitle(),
        },
        body: JSON.stringify({
          model,
          messages,
        }),
        signal: controller.signal,
      });

      const respostaJson = (await response.json().catch(() => null)) as OpenRouterResponse | null;

      if (!response.ok) {
        const detalheErro =
          respostaJson?.error?.message ||
          `Falha na API OpenRouter com status ${response.status}.`;

        failures += 1;
        console.warn(`[OpenRouter] Modelo ${model} falhou com status HTTP ${response.status}: ${detalheErro}`);

        if (hasNextModel) {
          await delay(OPENROUTER_MODEL_RETRY_DELAY_MS);
        }

        continue;
      }

      const textoResposta = respostaJson?.choices?.[0]?.message?.content?.trim();

      if (!textoResposta) {
        failures += 1;
        console.warn(`[OpenRouter] Modelo ${model} falhou: resposta vazia ou em formato inesperado.`);

        if (hasNextModel) {
          await delay(OPENROUTER_MODEL_RETRY_DELAY_MS);
        }

        continue;
      }

      console.info(`[OpenRouter] Modelo ${model} respondeu com sucesso.`);
      return {
        text: textoResposta,
        model,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        failures += 1;
        console.warn(`[OpenRouter] Modelo ${model} falhou por timeout apos ${OPENROUTER_TIMEOUT_MS}ms.`);

        if (hasNextModel) {
          await delay(OPENROUTER_MODEL_RETRY_DELAY_MS);
        }

        continue;
      }

      if (error instanceof Error) {
        failures += 1;
        console.warn(`[OpenRouter] Modelo ${model} falhou por erro de rede/execucao: ${error.message}`);

        if (hasNextModel) {
          await delay(OPENROUTER_MODEL_RETRY_DELAY_MS);
        }

        continue;
      }

      failures += 1;
      console.warn(`[OpenRouter] Modelo ${model} falhou por erro desconhecido.`);

      if (hasNextModel) {
        await delay(OPENROUTER_MODEL_RETRY_DELAY_MS);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.warn(`[OpenRouter] Todos os modelos falharam (${failures}/${openRouterModels.length}).`);
  throw new AppError(
    'Os modelos de IA estao temporariamente indisponiveis. Tente novamente em instantes.',
    503,
    'OPENROUTER_TEMPORARILY_UNAVAILABLE',
    { retryable: true },
  );
}

function getParseErrorType(error: unknown) {
  if (error instanceof SyntaxError) {
    return 'json_syntax';
  }

  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    return 'schema_validation';
  }

  if (error instanceof Error && error.message.includes('Delimitador')) {
    return 'missing_delimiter';
  }

  return 'unknown';
}

function logLearningParseWarning(model: string, rawResponse: string, error: unknown) {
  console.warn('[ChatParser] Falha ao extrair metadados da resposta do modelo.', {
    model,
    responseLength: rawResponse.length,
    hasJsonDelimiter: /---json---/i.test(rawResponse),
    hasEndDelimiter: /---fim---/i.test(rawResponse),
    errorType: getParseErrorType(error),
  });
}

function extractDelimitedJson(rawResponse: string) {
  const jsonStartMatches = [...rawResponse.matchAll(/---json---/gi)];
  const jsonStartMatch = jsonStartMatches[jsonStartMatches.length - 1];

  if (!jsonStartMatch || jsonStartMatch.index === undefined) {
    throw new Error(`Delimitador ${AI_METADATA_JSON_START} nao encontrado.`);
  }

  const jsonStartIndex = jsonStartMatch.index;
  const tutorText = rawResponse.slice(0, jsonStartIndex).trim();
  const jsonContentStart = jsonStartIndex + jsonStartMatch[0].length;
  const responseAfterJsonStart = rawResponse.slice(jsonContentStart);
  const jsonEndMatch = responseAfterJsonStart.match(/---fim---/i);

  if (!jsonEndMatch || jsonEndMatch.index === undefined) {
    throw new Error(`Delimitador ${AI_METADATA_JSON_END} nao encontrado.`);
  }

  return {
    tutorText,
    jsonSource: responseAfterJsonStart.slice(0, jsonEndMatch.index).trim(),
  };
}

function extractLastJsonObject(rawResponse: string) {
  let lastJsonObject: string | null = null;

  for (let startIndex = 0; startIndex < rawResponse.length; startIndex += 1) {
    if (rawResponse[startIndex] !== '{') {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let currentIndex = startIndex; currentIndex < rawResponse.length; currentIndex += 1) {
      const char = rawResponse[currentIndex];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = inString;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;

        if (depth === 0) {
          lastJsonObject = rawResponse.slice(startIndex, currentIndex + 1);
          break;
        }
      }
    }
  }

  return lastJsonObject;
}

function parseLearningMetadataJson(jsonSource: string) {
  const normalizedJsonSource = jsonSource
    .replace(/```[\w]*\n?/g, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();

  return aiChatMetadataSchema.parse(JSON.parse(normalizedJsonSource));
}

function parseLearningResponse(rawResponse: string, model: string): ParsedLearningResponse {
  try {
    const { tutorText, jsonSource } = extractDelimitedJson(rawResponse);
    const metadata = parseLearningMetadataJson(jsonSource);

    return {
      tutorText: tutorText || rawResponse,
      materia: metadata.materia,
      flashcard: metadata.flashcard,
    };
  } catch (primaryError) {
    logLearningParseWarning(model, rawResponse, primaryError);

    const fallbackJson = extractLastJsonObject(rawResponse);

    if (fallbackJson) {
      try {
        const metadata = parseLearningMetadataJson(fallbackJson);
        const fallbackText = rawResponse.slice(0, rawResponse.lastIndexOf(fallbackJson)).trim();

        return {
          tutorText: fallbackText || rawResponse,
          materia: metadata.materia,
          flashcard: metadata.flashcard,
        };
      } catch (fallbackError) {
        logLearningParseWarning(model, rawResponse, fallbackError);
      }
    }

    return {
      tutorText: rawResponse,
      materia: null,
      flashcard: null,
    };
  }
}

function stripMetadataBlock(rawResponse: string) {
  const metadataMarker = rawResponse.match(/(?:^|\r?\n)\s*---\s*(?:\r?\n\s*)?json\s*(?:---)?\s*(?:\r?\n|$)/i);

  if (!metadataMarker || metadataMarker.index === undefined) {
    return rawResponse.trim();
  }

  return rawResponse.slice(0, metadataMarker.index).trim() || rawResponse.trim();
}

async function buildFlow(data: {
  topic: string;
  subjectTopic: string;
  isFollowUp: boolean;
  requestTopic?: string;
  aiReply: string;
  interests: string[];
  latestErrorQuestion?: string | null;
}) {
  return {
    aiReply: data.aiReply,
    activationPrompt: data.isFollowUp ? '' : `Antes de eu explicar, o que voce ja sabe sobre ${data.subjectTopic}?`,
    explanation: data.aiReply,
    interests: data.interests,
    deliberatePractice: {
      focus: data.latestErrorQuestion
        ? `Vou reforcar um ponto em que voce errou recentemente: ${data.latestErrorQuestion}`
        : data.isFollowUp
          ? ''
          : `Vamos treinar ${data.subjectTopic} com foco em erros comuns.`,
      questions: [],
    },
    applicationPrompt: data.isFollowUp
      ? ''
      : `Agora aplique ${data.subjectTopic} em uma situacao real do seu curso, trabalho ou rotina e descreva como voce usaria esse conceito.`,
    flashcardSuggestion: {
      pergunta: data.isFollowUp ? '' : `Qual e a ideia central de ${data.subjectTopic}?`,
      resposta: data.isFollowUp ? '' : buildExplanation(data.subjectTopic, data.interests),
    },
  };
}

function inferSubjectTopic(currentTopic: string | undefined, history: ConversationHistoryMessage[]) {
  const firstUserMessage = history.find((message) => message.role === 'user')?.content?.trim();
  return firstUserMessage || currentTopic?.trim() || 'assunto atual';
}

function mapStoredMessages(messages: StoredChatMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    flow: message.flow ?? null,
    createdAt: message.createdAt,
  }));
}

export async function listarConversasSalvas(userId: string) {
  return prisma.chatConversation.findMany({
    where: { userId },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
      materia: {
        select: {
          id: true,
          nome: true,
          cor: true,
        },
      },
    },
  });
}

export async function buscarConversaSalva(chatId: string, userId: string) {
  const chat = await prisma.chatConversation.findFirst({
    where: {
      id: chatId,
      userId,
    },
    include: {
      materia: {
        select: {
          id: true,
          nome: true,
          cor: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!chat) {
    throw notFound('Conversa nao encontrada', 'CHAT_NOT_FOUND');
  }

  return {
    ...chat,
    messages: mapStoredMessages(chat.messages as StoredChatMessage[]),
    history: (chat.messages as Array<{ role: string; content: string }>).map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    })),
  };
}

export async function enviarMensagemAprender(data: {
  chatId?: string;
  topic?: string;
  requestTopic?: string;
  userId?: string;
  materiaId?: string;
  messages?: ConversationHistoryMessage[];
}) {
  const normalizedTopic = typeof data.topic === 'string' ? data.topic.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  const normalizedRequestTopic =
    typeof data.requestTopic === 'string' ? data.requestTopic.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  const user = data.userId
    ? await prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          interests: true,
          nome: true,
        },
      })
    : null;

  if (data.userId && data.materiaId) {
    const materia = await prisma.materia.findFirst({
      where: {
        id: data.materiaId,
        userId: data.userId,
      },
      select: { id: true },
    });

    if (!materia) {
      throw notFound('Materia nao encontrada', 'MATERIA_NOT_FOUND');
    }
  }

  const interests = parseInterests(user?.interests);

  const latestError = data.userId && data.materiaId
    ? await prisma.respostaQuestao.findFirst({
        where: {
          userId: data.userId,
          acertou: false,
          questao: {
            materiaId: data.materiaId,
          },
        },
        include: {
          questao: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    : null;

  const providedHistory = sanitizeConversationHistory(data.messages)
    .filter((message) => message.role === 'user' || message.role === 'assistant');
  const currentUserMessage = normalizedTopic || normalizedRequestTopic || '';
  const historyWithCurrentUser =
    currentUserMessage &&
    !(
      providedHistory[providedHistory.length - 1]?.role === 'user' &&
      providedHistory[providedHistory.length - 1]?.content === currentUserMessage
    )
      ? [...providedHistory, { role: 'user' as const, content: currentUserMessage }]
      : providedHistory;
  const subjectTopic = inferSubjectTopic(currentUserMessage || data.topic, historyWithCurrentUser);
  const isFollowUp = currentUserMessage
    ? isLikelyFollowUpMessage(currentUserMessage, providedHistory)
    : false;
  let openRouterMessages: ConversationHistoryMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        topic: subjectTopic,
        requestTopic: normalizedRequestTopic,
        userName: user?.nome,
        interests,
        latestErrorQuestion: latestError?.questao.enunciado,
        includeMetadata: Boolean(data.userId),
      }),
    },
    ...historyWithCurrentUser,
  ];
  openRouterMessages = gerenciarJanelaDeTokens(openRouterMessages, 6000);

  const aiCompletion = await perguntarIAOpenRouterCompletion(openRouterMessages);
  const parsedLearningResponse = data.userId
    ? parseLearningResponse(aiCompletion.text, aiCompletion.model)
    : {
        tutorText: stripMetadataBlock(aiCompletion.text),
        materia: null,
        flashcard: null,
      };
  const aiReply = parsedLearningResponse.tutorText;
  const metadataFlashcard = parsedLearningResponse.flashcard
    ? {
        pergunta: parsedLearningResponse.flashcard.frente,
        resposta: parsedLearningResponse.flashcard.verso,
      }
    : null;
  const baseFlow = await buildFlow({
    topic: currentUserMessage || subjectTopic,
    subjectTopic,
    isFollowUp,
    requestTopic: normalizedRequestTopic,
    aiReply,
    interests,
    latestErrorQuestion: latestError?.questao.enunciado,
  });
  const flow = {
    ...baseFlow,
    flashcardSuggestion: metadataFlashcard,
  };

  if (!data.userId) {
    return {
      ...flow,
      resposta: aiReply,
      materia: parsedLearningResponse.materia,
      flashcard: parsedLearningResponse.flashcard,
      chatId: null,
      history: [...historyWithCurrentUser, { role: 'assistant' as const, content: aiReply }],
      storedMessages: [],
    };
  }

  const lastUserMessage = [...historyWithCurrentUser].reverse().find((message) => message.role === 'user');

  if (!lastUserMessage) {
    throw badRequest('Nao foi encontrada a mensagem do usuario para salvar a conversa.', 'CHAT_LAST_USER_MESSAGE_NOT_FOUND');
  }

  const currentChat =
    data.chatId
      ? await prisma.chatConversation.findFirst({
          where: {
            id: data.chatId,
            userId: data.userId,
          },
        })
      : null;

  if (data.chatId && !currentChat) {
    throw notFound('Conversa nao encontrada', 'CHAT_NOT_FOUND');
  }

  const chat =
    currentChat ||
    await prisma.chatConversation.create({
      data: {
        title: buildSmartConversationTitle(subjectTopic, aiReply),
        userId: data.userId,
        materiaId: data.materiaId,
      },
    });

  const [savedUserMessage, savedAssistantMessage] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content: lastUserMessage.content,
      },
    }),
    prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'assistant',
        content: aiReply,
        flow,
      },
    }),
    prisma.chatConversation.update({
      where: { id: chat.id },
      data: {
        title: currentChat?.title || buildSmartConversationTitle(subjectTopic, aiReply),
        materiaId: data.materiaId || currentChat?.materiaId || null,
        lastMessageAt: new Date(),
      },
    }),
  ]);

  return {
    ...flow,
    resposta: aiReply,
    materia: parsedLearningResponse.materia,
    flashcard: parsedLearningResponse.flashcard,
    chatId: chat.id,
    history: [...historyWithCurrentUser, { role: 'assistant' as const, content: aiReply }],
    storedMessages: mapStoredMessages([
      {
        id: savedUserMessage.id,
        role: 'user',
        content: savedUserMessage.content,
        createdAt: savedUserMessage.createdAt,
      },
      {
        id: savedAssistantMessage.id,
        role: 'assistant',
        content: savedAssistantMessage.content,
        flow,
        createdAt: savedAssistantMessage.createdAt,
      },
    ]),
  };
}
