import type { ExtractedEntityInput, FindingInput } from "../analyses/analysis.types.js";
import { redactIdentifier, redactSensitiveText } from "../analyses/dataSanitization.js";
import { aiStructuredOutputSchema, type AiStructuredOutput } from "./ai.schemas.js";
import { AiProviderUnavailableError, type AiAnalysisProvider } from "./aiProvider.js";

export type AiAnalysisRun = {
  status: "available" | "disabled" | "unavailable" | "invalid" | "error";
  provider?: string;
  output?: AiStructuredOutput;
  limitations: string[];
};

function normalizeForEvidenceCheck(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function quoteAppearsInEvidence(quote: string, allEvidence: string[]): boolean {
  const normalizedQuote = normalizeForEvidenceCheck(quote);
  return normalizedQuote.length >= 3 && allEvidence.some((evidence) => normalizeForEvidenceCheck(evidence).includes(normalizedQuote));
}

/**
 * Parses an untrusted provider response. Invalid structures are discarded;
 * callers receive a limitation instead of partially trusting a free-form reply.
 */
export function validateAiStructuredOutput(value: unknown): AiStructuredOutput | undefined {
  const parsed = aiStructuredOutputSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export async function runAiAnalysis(input: {
  provider: AiAnalysisProvider;
  allowExternalProcessing: boolean;
  locale: string;
  evidence: Array<{ publicId: string; type: "text" | "image" | "url" | "email" | "message" | "payment_request" | "call_transcript" | "website_copy" | "manual"; channel: "sms" | "email" | "chat" | "social_media" | "marketplace" | "phone_call" | "website" | "unknown"; text: string }>;
}): Promise<AiAnalysisRun> {
  if (!input.allowExternalProcessing) {
    return { status: "disabled", limitations: ["External AI processing is disabled for this analysis. Deterministic checks still ran."] };
  }
  try {
    const raw = await input.provider.analyzeEvidence({
      locale: input.locale,
      evidence: input.evidence.map(({ publicId, type, channel, text }) => ({ publicId, type, channel, untrustedText: text })),
    });
    const output = validateAiStructuredOutput(raw);
    if (!output) return { status: "invalid", provider: input.provider.name, limitations: ["The AI provider returned an invalid structured result, so it was discarded."] };
    return { status: "available", provider: input.provider.name, output, limitations: output.limitations.map((item) => redactSensitiveText(item, 300)) };
  } catch (error) {
    if (error instanceof AiProviderUnavailableError) return { status: "unavailable", provider: input.provider.name, limitations: ["No AI provider result is available for this analysis."] };
    return { status: "error", provider: input.provider.name, limitations: ["The AI provider did not return a usable result. Deterministic checks were not affected."] };
  }
}

/**
 * Converts only anchored, schema-validated suggestions into constrained domain
 * values. AI cannot select arbitrary actions, create privileged operations, or
 * raise a finding above high severity on its own.
 */
export function aiOutputToFindings(output: AiStructuredOutput, evidence: Array<{ publicId: string; text: string }>): FindingInput[] {
  const allText = evidence.map((item) => item.text);
  return output.findings.flatMap((suggestion) => {
    if (!quoteAppearsInEvidence(suggestion.quotedEvidence, allText)) return [];
    const evidencePublicId = evidence.find((item) => normalizeForEvidenceCheck(item.text).includes(normalizeForEvidenceCheck(suggestion.quotedEvidence)))?.publicId;
    if (!evidencePublicId) return [];
    const severity = suggestion.severity === "critical" ? "high" : suggestion.severity;
    const confidence = suggestion.confidence === "strong" ? "moderate" : suggestion.confidence;
    return [{
      code: suggestion.code,
      category: suggestion.category,
      state: "detected",
      severity,
      confidence,
      title: "AI noted a potentially suspicious message pattern",
      explanation: redactSensitiveText(suggestion.explanation, 700),
      evidence: [{ evidencePublicId, excerpt: redactSensitiveText(suggestion.quotedEvidence, 240) }],
      recommendedActionKeys: suggestion.recommendedActionKeys,
      source: "ai",
    }];
  });
}

export function aiOutputToEntities(output: AiStructuredOutput, evidence: Array<{ publicId: string; text: string }>): ExtractedEntityInput[] {
  const allText = evidence.map((item) => item.text);
  return output.entities.flatMap((candidate) => {
    if (!quoteAppearsInEvidence(candidate.quotedEvidence, allText)) return [];
    const source = evidence.find((item) => normalizeForEvidenceCheck(item.text).includes(normalizeForEvidenceCheck(candidate.quotedEvidence)));
    if (!source) return [];
    const value = candidate.value.trim();
    return [{
      kind: candidate.kind,
      value,
      normalizedValue: value.toLowerCase(),
      displayValue: ["phone", "payment_handle"].includes(candidate.kind) ? redactIdentifier(value) : redactSensitiveText(value, 180),
      classification: ["phone", "payment_handle"].includes(candidate.kind) ? "restricted" : "private",
      sourceEvidencePublicId: source.publicId,
      source: "ai",
      confidence: "limited",
    }];
  });
}
