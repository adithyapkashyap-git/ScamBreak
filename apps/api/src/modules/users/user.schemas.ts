import { z } from 'zod';

import { displayNameSchema, passwordSchema } from '../auth/auth.schemas.js';

export const updateCurrentUserBodySchema = z
  .object({
    displayName: displayNameSchema.optional(),
    privacy: z
      .object({
        analysisRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
        allowCommunityReportPrompts: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .refine((value) => value.displayName !== undefined || value.privacy !== undefined, {
    message: 'Provide at least one account setting to update.'
  });

export const updatePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password that differs from your current password.'
  });

export const deleteAccountBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128)
  })
  .strict();

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserBodySchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordBodySchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountBodySchema>;
