-- Add challenge-scoped question responses so deleting a challenge can remove its related answers.
ALTER TABLE "RespostaQuestao" ADD COLUMN IF NOT EXISTS "desafioId" TEXT;

-- Re-scope response uniqueness to allow the same user/question pair in different challenges.
DROP INDEX IF EXISTS "RespostaQuestao_userId_questaoId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "RespostaQuestao_userId_questaoId_desafioId_key" ON "RespostaQuestao"("userId", "questaoId", "desafioId");
CREATE INDEX IF NOT EXISTS "RespostaQuestao_userId_questaoId_idx" ON "RespostaQuestao"("userId", "questaoId");
CREATE INDEX IF NOT EXISTS "RespostaQuestao_desafioId_idx" ON "RespostaQuestao"("desafioId");

-- Replace existing foreign keys with cascading behavior for study data owned by a subject.
ALTER TABLE "Flashcard" DROP CONSTRAINT IF EXISTS "Flashcard_materiaId_fkey";
ALTER TABLE "Flashcard"
  ADD CONSTRAINT "Flashcard_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Questao" DROP CONSTRAINT IF EXISTS "Questao_materiaId_fkey";
ALTER TABLE "Questao"
  ADD CONSTRAINT "Questao_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Progresso" DROP CONSTRAINT IF EXISTS "Progresso_materiaId_fkey";
ALTER TABLE "Progresso"
  ADD CONSTRAINT "Progresso_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessaoEstudo" DROP CONSTRAINT IF EXISTS "SessaoEstudo_materiaId_fkey";
ALTER TABLE "SessaoEstudo"
  ADD CONSTRAINT "SessaoEstudo_materiaId_fkey"
  FOREIGN KEY ("materiaId") REFERENCES "Materia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Revisao" DROP CONSTRAINT IF EXISTS "Revisao_flashcardId_fkey";
ALTER TABLE "Revisao"
  ADD CONSTRAINT "Revisao_flashcardId_fkey"
  FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RespostaQuestao" DROP CONSTRAINT IF EXISTS "RespostaQuestao_questaoId_fkey";
ALTER TABLE "RespostaQuestao"
  ADD CONSTRAINT "RespostaQuestao_questaoId_fkey"
  FOREIGN KEY ("questaoId") REFERENCES "Questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RespostaQuestao" DROP CONSTRAINT IF EXISTS "RespostaQuestao_desafioId_fkey";
ALTER TABLE "RespostaQuestao"
  ADD CONSTRAINT "RespostaQuestao_desafioId_fkey"
  FOREIGN KEY ("desafioId") REFERENCES "Desafio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
