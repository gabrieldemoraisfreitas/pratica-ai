CREATE INDEX "Materia_userId_idx" ON "Materia"("userId");

CREATE INDEX "ChatConversation_userId_lastMessageAt_idx" ON "ChatConversation"("userId", "lastMessageAt");
CREATE INDEX "ChatConversation_materiaId_idx" ON "ChatConversation"("materiaId");

CREATE INDEX "ChatMessage_chatId_createdAt_idx" ON "ChatMessage"("chatId", "createdAt");

CREATE INDEX "Flashcard_materiaId_nextReview_idx" ON "Flashcard"("materiaId", "nextReview");

CREATE INDEX "Revisao_flashcardId_createdAt_idx" ON "Revisao"("flashcardId", "createdAt");

CREATE INDEX "SessaoEstudo_userId_createdAt_idx" ON "SessaoEstudo"("userId", "createdAt");
CREATE INDEX "SessaoEstudo_materiaId_idx" ON "SessaoEstudo"("materiaId");

CREATE INDEX "Questao_materiaId_createdAt_idx" ON "Questao"("materiaId", "createdAt");

CREATE INDEX "RespostaQuestao_userId_createdAt_idx" ON "RespostaQuestao"("userId", "createdAt");
CREATE INDEX "RespostaQuestao_questaoId_idx" ON "RespostaQuestao"("questaoId");

CREATE INDEX "Desafio_criadorId_createdAt_idx" ON "Desafio"("criadorId", "createdAt");
CREATE INDEX "Desafio_convidadoId_createdAt_idx" ON "Desafio"("convidadoId", "createdAt");
CREATE INDEX "Desafio_expiraEm_idx" ON "Desafio"("expiraEm");

CREATE INDEX "Notificacao_userId_createdAt_idx" ON "Notificacao"("userId", "createdAt");
