import { z } from "zod";

const safeActionKeySchema = z.enum([
  "pause_and_verify",
  "do_not_click",
  "do_not_share_credentials",
  "do_not_pay",
  "do_not_install_software",
  "disconnect_if_connected",
  "contact_independently",
  "open_official_app",
  "verify_company_independently",
  "preserve_evidence",
  "change_password_if_shared",
  "secure_accounts",
  "use_platform_only",
  "talk_to_someone_trusted",
]);

export const aiEntityCandidateSchema = z
  .object({
    kind: z.enum(["organization", "person", "email", "phone", "url", "domain", "payment_handle", "amount", "deadline", "requested_action", "product_service"]),
    value: z.string().trim().min(1).max(500),
    quotedEvidence: z.string().trim().min(1).max(500),
  })
  .strict();

export const aiFindingSuggestionSchema = z
  .object({
    code: z.string().trim().regex(/^semantic_[a-z0-9_]{3,64}$/).max(80),
    category: z.enum(["social_engineering", "impersonation", "payment", "credential_theft", "data_theft", "account_warning", "job_recruitment", "investment", "delivery_refund", "other"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    confidence: z.enum(["limited", "moderate", "strong"]),
    explanation: z.string().trim().min(1).max(700),
    quotedEvidence: z.string().trim().min(1).max(500),
    recommendedActionKeys: z.array(safeActionKeySchema).max(5).default([]),
  })
  .strict();

export const aiStructuredOutputSchema = z
  .object({
    summary: z.string().trim().max(1_000).optional(),
    entities: z.array(aiEntityCandidateSchema).max(30).default([]),
    findings: z.array(aiFindingSuggestionSchema).max(15).default([]),
    limitations: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  })
  .strict();

export type AiStructuredOutput = z.infer<typeof aiStructuredOutputSchema>;
