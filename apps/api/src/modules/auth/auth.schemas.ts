import { z } from 'zod';

const emailSchema = z.string().trim().email('Enter a valid email address.').max(254).transform((value) => value.toLowerCase());

// Passphrases are allowed; character-composition rules create predictable passwords
// and can exclude users. Length is the enforceable baseline, with breach-password
// checks intentionally left to a future provider rather than faked locally.
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters for your password.')
  .max(128, 'Password must not exceed 128 characters.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must contain at least 2 characters.')
  .max(80, 'Display name must not exceed 80 characters.')
  .refine((value) => /\S/u.test(value), 'Display name cannot be blank.');

export const registerBodySchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128)
  })
  .strict();

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
