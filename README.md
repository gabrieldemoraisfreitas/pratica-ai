# Pratica AI

Aplicação web de estudos com IA para tutoria, flashcards e prática personalizada.

## Stack

- Backend: Node.js, Express, TypeScript, Prisma e PostgreSQL
- Frontend: React, Vite, TypeScript e React Query
- IA: OpenRouter

## Funcionalidades

- Chat tutor com IA
- Modo visitante sem salvar histórico
- Conversas salvas para usuários logados
- Detecção de matéria para usuários logados
- Sugestão e criação de flashcards
- Revisão de flashcards
- Histórico de conversas por usuário

## Configuração

Crie um arquivo `.env` na raiz com base em `.env.example`.

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/domino_db"
OPENROUTER_API_KEY="sua-chave-openrouter"
AUTH_SECRET="uma-chave-com-pelo-menos-32-caracteres"