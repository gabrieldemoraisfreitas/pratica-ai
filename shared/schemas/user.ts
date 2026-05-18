import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'E-mail é obrigatório')
  .email('Digite um e-mail válido')
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .trim()
  .min(6, 'A senha precisa ter pelo menos 6 caracteres');

const requiredNameSchema = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório');

const optionalTextSchema = z.preprocess(
  (value) => (value === null ? undefined : value),
  z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional(),
);

export const registerSchema = z.object({
  email: emailSchema,
  senha: passwordSchema,
  nome: optionalTextSchema,
  interests: optionalTextSchema,
  avatar: optionalTextSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().trim().min(1, 'Senha é obrigatória'),
});

export const updateProfileSchema = z.object({
  email: emailSchema.optional(),
  senha: passwordSchema.optional(),
  nome: requiredNameSchema.optional(),
  interests: optionalTextSchema,
  avatar: optionalTextSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
