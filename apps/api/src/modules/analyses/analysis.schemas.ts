import { z } from "zod";

import { evidenceChannels, evidenceTypes } from "./analysis.types.js";

export const publicIdSchema = z.string().regex(/^[a-z][a-z0-9_]*_[A-Za-z0-9_-]{16,}$/i, "Invalid public identifier");

export const evidenceInputSchema = z
  .object({
    type: z.enum(evidenceTypes),
    channel: z.enum(evidenceChannels).default("unknown"),
    text: z.string().trim().min(1).max(50_000).optional(),
    url: z.string().trim().max(4_096).optional(),
    filePublicId: publicIdSchema.optional(),
    label: z.string().trim().min(1).max(120).optional(),
    metadata: z
      .object({
        senderLabel: z.string().trim().max(160).optional(),
        receivedAt: z.coerce.date().optional(),
        languageHint: z.string().trim().max(24).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasText = Boolean(value.text);
    const hasUrl = Boolean(value.url);
    const hasFile = Boolean(value.filePublicId);
    if (!hasText && !hasUrl && !hasFile) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence must contain text, a URL, or an uploaded file." });
    }
    if (value.type === "url" && !hasUrl && !hasText) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL evidence requires a URL value." });
    }
    if (value.type === "image" && !hasFile) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Image evidence requires an uploaded file reference." });
    }
  });

export const createAnalysisSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    evidence: z.array(evidenceInputSchema).min(1).max(20),
    locale: z.string().trim().min(2).max(16).default("en"),
    /** Opt-in only; external providers never receive evidence without this. */
    allowExternalAiProcessing: z.boolean().default(false),
  })
  .strict();

export const paginationSchema = z
  .object({
    cursor: z.string().min(1).max(256).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const deleteAnalysisSchema = z.object({ acknowledgement: z.literal(true) }).strict();

export const analysisParamsSchema = z.object({ analysisId: publicIdSchema }).strict();

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
