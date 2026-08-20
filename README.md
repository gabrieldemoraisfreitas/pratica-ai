# Pratica AI

Aplicação web full stack de estudos com IA: tutor conversacional em português, geração automática de flashcards a partir da conversa, revisão por repetição espaçada e autenticação própria.

> **TL;DR:** backend Node/Express/Prisma com fallback resiliente entre 11 modelos de IA via OpenRouter, JWT implementado manualmente (HMAC-SHA256), frontend React/Vite. Testes com Jest cobrindo auth, parsing de IA e regras de posse de dados.

## Funcionalidades

- **Chat tutor com IA**, com modo visitante (sem salvar histórico) e modo autenticado (conversas persistidas)
- **Detecção automática de matéria** a partir da conversa, para usuários logados
- **Geração automática de flashcards** extraídos da própria resposta da IA
- **Revisão por repetição espaçada** — intervalo entre revisões dobra a cada acerto, com teto máximo
- **Histórico de conversas** por usuário, com título gerado automaticamente a partir do tópico discutido
- **Desafios entre usuários** com questões e resultados comparados

## Por que esse projeto é o mais representativo do meu trabalho

### Resiliência com IA em produção, não só chamada de API

Modelos gratuitos de LLM falham de formas imprevisíveis: um responde em formato diferente do pedido, outro devolve corpo vazio, outro simplesmente não retorna dentro do tempo esperado. Em vez de depender de um único modelo, o backend tenta em cascata uma lista configurável de modelos (hoje 11), com timeout individual, backoff entre tentativas e log de qual modelo efetivamente respondeu — se todos falharem, o erro é reportado de forma explícita e marcado como `retryable`.

A resposta da IA também precisa devolver texto livre **e** metadados estruturados (matéria detectada, sugestão de flashcard) no mesmo corpo. Como nem todo modelo respeita o formato pedido à risca, o parser tenta primeiro o delimitador esperado e, se falhar, cai para uma extração tolerante que varre a resposta procurando o último objeto JSON válido por contagem de chaves — sem depender de regex frágil. Quando mesmo assim não há JSON extraível, a conversa continua normalmente só com o texto, sem quebrar a experiência do usuário.

Há também gerenciamento de janela de contexto: o histórico é truncado por estimativa de tokens antes de cada chamada, removendo as mensagens mais antigas primeiro e sempre preservando o prompt de sistema.

### Autenticação própria, não uma lib pronta

O JWT é implementado manualmente com HMAC-SHA256 (header, payload e assinatura codificados e verificados à mão, com comparação de assinatura em tempo constante via `timingSafeEqual` para evitar timing attack). O token carrega um `tokenVersion` que é comparado contra o valor salvo no banco a cada requisição — isso permite invalidar todas as sessões de um usuário (ex.: troca de senha) sem precisar de uma blocklist de tokens. Há também rate limiting de tentativas de login por IP, com janela deslizante em memória.

### Modelagem de dados pensada para o domínio

O schema (Prisma/PostgreSQL) já reflete casos de borda reais do domínio: cascata de exclusão configurada por relação (apagar uma matéria remove seus flashcards, mas não o usuário), índices compostos nas consultas mais frequentes (ex.: flashcards por matéria ordenados por próxima revisão), e uma constraint de unicidade em `RespostaQuestao` que impede resposta duplicada para a mesma questão dentro do mesmo desafio.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, Vite, TypeScript, TanStack Query, Tailwind CSS
- **IA:** OpenRouter (fallback entre múltiplos modelos gratuitos)
- **Testes:** Jest + Supertest

## Como rodar

```bash
git clone https://github.com/gabrieldemoraisfreitas/pratica-ai.git
cd pratica-ai
npm install
cp .env.example .env   # preencher DATABASE_URL, OPENROUTER_API_KEY e AUTH_SECRET
npx prisma migrate dev
npm run dev
```

Variáveis obrigatórias no `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pratica_ai"
OPENROUTER_API_KEY="sua-chave-openrouter"
AUTH_SECRET="uma-chave-com-pelo-menos-32-caracteres"
```

Frontend em `frontend/`, com seu próprio `.env.example`.

## Testes

```bash
npm test
```

Cobrem autenticação (emissão/validação de token, invalidação por `tokenVersion`), parsing da resposta da IA (delimitador presente, ausente, JSON malformado) e regras de posse de recursos (um usuário não acessa flashcards ou conversas de outro).

## Limitações conhecidas

- Depende de modelos gratuitos do OpenRouter, que têm limites de uso e disponibilidade variável — em produção real valeria um modelo pago como fallback final
- Front e back estão no mesmo repositório sem pipeline de deploy configurado ainda

## Relacionado

- [Pratica AI Mobile](https://github.com/gabrieldemoraisfreitas/pratica-mobile) — cliente Flutter que consome esta mesma API
