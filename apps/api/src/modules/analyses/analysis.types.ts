/**
 * Domain contracts shared by the ScamBreak analysis modules.
 *
 * These are deliberately not API DTOs.  Raw evidence and restricted values
 * stay in persistence/domain objects; serializers create the public view.
 */

export const riskLevels = ["critical", "high", "medium", "low", "unclear"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const findingSeverities = ["info", "low", "medium", "high", "critical"] as const;
export type FindingSeverity = (typeof findingSeverities)[number];

export const confidenceLevels = ["limited", "moderate", "strong"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const findingStates = ["detected", "not_detected", "unknown"] as const;
export type FindingState = (typeof findingStates)[number];

export const evidenceTypes = [
  "text",
  "image",
  "url",
  "email",
  "message",
  "payment_request",
  "call_transcript",
  "website_copy",
  "manual",
] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

export const evidenceChannels = [
  "sms",
  "email",
  "chat",
  "social_media",
  "marketplace",
  "phone_call",
  "website",
  "unknown",
] as const;
export type EvidenceChannel = (typeof evidenceChannels)[number];

export const entityKinds = [
  "organization",
  "person",
  "email",
  "phone",
  "url",
  "domain",
  "payment_handle",
  "bank_instruction",
  "amount",
  "currency",
  "deadline",
  "requested_action",
  "product_service",
  "account_identifier",
] as const;
export type EntityKind = (typeof entityKinds)[number];

export const dataClassifications = ["public", "internal", "private", "restricted"] as const;
export type DataClassification = (typeof dataClassifications)[number];

export type ExtractedEntityInput = {
  kind: EntityKind;
  /** Raw value is restricted and must never be returned from the normal API. */
  value: string;
  normalizedValue: string;
  displayValue: string;
  classification: DataClassification;
  sourceEvidencePublicId: string;
  source: "deterministic" | "ocr" | "ai" | "manual";
  confidence: ConfidenceLevel;
  startOffset?: number;
  endOffset?: number;
};

export type FindingInput = {
  code: string;
  category: string;
  state: FindingState;
  severity: FindingSeverity;
  confidence: ConfidenceLevel;
  title: string;
  explanation: string;
  evidence: Array<{
    evidencePublicId: string;
    /** A short, redacted excerpt. Do not put OTPs/payment credentials here. */
    excerpt: string;
    entityKinds?: EntityKind[];
  }>;
  recommendedActionKeys: string[];
  patternIds?: string[];
  technicalDetails?: Record<string, unknown>;
  source: "rule" | "url" | "pattern" | "ai" | "verification";
};

export type RiskAssessmentInput = {
  level: RiskLevel;
  score: number | null;
  confidence: ConfidenceLevel;
  rationale: string[];
  limitations: string[];
  engineVersion: string;
  scoringConfigVersion: string;
  contributions: Array<{
    findingCode: string;
    points: number;
    reason: string;
  }>;
};

export type SafeAction = {
  key: string;
  priority: "immediate" | "today" | "next";
  title: string;
  description: string;
  when: string;
  isSafetyCritical?: boolean;
};

export type VerificationStep = {
  key: string;
  title: string;
  description: string;
  /** True only when the provided contact/link is itself part of untrusted evidence. */
  avoidUntrustedContact: boolean;
};

export type AnalysisResult = {
  findings: FindingInput[];
  risk: RiskAssessmentInput;
  safeActions: SafeAction[];
  verificationSteps: VerificationStep[];
  matchedPatternIds: string[];
  limitations: string[];
};

export const analysisStatuses = ["draft", "processing", "complete", "failed", "deleted"] as const;
export type AnalysisStatus = (typeof analysisStatuses)[number];
