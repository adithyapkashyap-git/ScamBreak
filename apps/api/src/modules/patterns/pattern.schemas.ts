import { z } from 'zod';

import { publicIdSchema } from '../analyses/analysis.schemas.js';

const findingSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
const channelSchema = z.enum(['sms', 'email', 'chat', 'social_media', 'marketplace', 'phone_call', 'website', 'unknown']);
const entityKindSchema = z.enum([
  'organization', 'person', 'email', 'phone', 'url', 'domain', 'payment_handle', 'bank_instruction', 'amount', 'currency', 'deadline', 'requested_action', 'product_service', 'account_identifier'
]);

export const patternInputSchema = z
  .object({
    patternId: z.string().trim().regex(/^[a-z0-9_]{3,100}$/),
    category: z.string().trim().min(2).max(100),
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().min(20).max(2_000),
    indicators: z
      .object({
        anyFindingCodes: z.array(z.string().trim().min(2).max(100)).max(30).default([]),
        allFindingCodes: z.array(z.string().trim().min(2).max(100)).max(30).default([]),
        entityKinds: z.array(entityKindSchema).max(20).default([]),
        minMatchedIndicators: z.coerce.number().int().min(1).max(30)
      })
      .strict(),
    severity: findingSeveritySchema,
    applicableChannels: z.array(channelSchema).min(1).max(8),
    recommendedProtectiveActions: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
    aliases: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
    examples: z.array(z.string().trim().min(2).max(500)).max(10).default([]),
    version: z.string().trim().min(1).max(40),
    status: z.enum(['active', 'retired', 'draft'])
  })
  .strict()
  .superRefine((value, context) => {
    if (value.indicators.anyFindingCodes.length + value.indicators.entityKinds.length < value.indicators.minMatchedIndicators) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['indicators', 'minMatchedIndicators'],
        message: 'The required indicator count cannot exceed the available indicators.'
      });
    }
  });

export const patternParamsSchema = z.object({ patternId: publicIdSchema.or(z.string().regex(/^[a-z0-9_]{3,100}$/)) }).strict();
export const patternListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(100) }).strict();

export type PatternInput = z.infer<typeof patternInputSchema>;
