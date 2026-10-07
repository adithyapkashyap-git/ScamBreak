import { z } from 'zod';

import { publicIdSchema } from '../analyses/analysis.schemas.js';

export const createCommunityReportSchema = z
  .object({
    analysisId: publicIdSchema.optional(),
    category: z.string().trim().min(2).max(100),
    patternId: z.string().trim().min(2).max(100).optional(),
    occurredOn: z.coerce.date().max(new Date()).optional(),
    description: z.string().trim().min(20).max(1_500).optional(),
    /**
     * A submitter must explicitly opt into each normalized signal. Raw evidence
     * is never copied into a community report.
     */
    shareSignalKinds: z.array(z.enum(['domain', 'phone', 'email', 'payment_handle'])).max(4).default([])
  })
  .strict()
  .refine((value) => Boolean(value.analysisId || value.description), {
    message: 'Link an analysis or provide a private description for moderation.'
  });

export const communityPaginationSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();

export const myCommunityReportPaginationSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();

export const reportParamsSchema = z.object({ reportId: publicIdSchema }).strict();

export const moderationDecisionSchema = z
  .object({
    decision: z.enum(['published', 'rejected']),
    publicSummary: z.string().trim().min(20).max(800).optional(),
    moderationNote: z.string().trim().min(1).max(1_000).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === 'published' && !value.publicSummary) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['publicSummary'], message: 'A moderator-authored public summary is required to publish a report.' });
    }
  });

export const createAbuseReportSchema = z
  .object({
    reason: z.enum(['privacy', 'harassment', 'false_information', 'spam', 'other']),
    detail: z.string().trim().min(10).max(1_000).optional()
  })
  .strict();

export type CreateCommunityReportInput = z.infer<typeof createCommunityReportSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type CreateAbuseReportInput = z.infer<typeof createAbuseReportSchema>;
