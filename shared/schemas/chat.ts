import { z } from 'zod';

export const chatMateriaOptions = [
  'Matemática',
  'Biologia',
  'Química',
  'Física',
  'História',
  'Geografia',
  'Português',
  'Redação',
  'Inglês',
  'Literatura',
  'Filosofia',
  'Sociologia',
  'Programação',
] as const;

export const aiChatMetadataSchema = z.object({
  materia: z
    .enum(chatMateriaOptions)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  flashcard: z
    .object({
      frente: z.string().trim().min(1).max(500),
      verso: z.string().trim().min(1).max(500),
    })
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type AiChatMetadata = z.infer<typeof aiChatMetadataSchema>;
export type ChatMateria = AiChatMetadata['materia'];
export type ChatFlashcard = NonNullable<AiChatMetadata['flashcard']>;
