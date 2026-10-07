import type { EvidenceChannel, EvidenceType } from "../analyses/analysis.types.js";
import type { AiStructuredOutput } from "./ai.schemas.js";

/**
 * Provider boundary: inputs are untrusted evidence data, not instructions.
 * Implementations must use a fixed system prompt and structured-output mode.
 */
export interface AiAnalysisProvider {
  readonly name: string;
  analyzeEvidence(input: {
    locale: string;
    evidence: Array<{
      publicId: string;
      type: EvidenceType;
      channel: EvidenceChannel;
      /** Explicitly label this field as hostile/untrusted in any provider prompt. */
      untrustedText: string;
    }>;
  }): Promise<unknown>;
}

/** Safe local fallback. It never makes an external AI request or invents a result. */
export class UnavailableAiProvider implements AiAnalysisProvider {
  readonly name = "unavailable";

  async analyzeEvidence(): Promise<unknown> {
    throw new AiProviderUnavailableError("No AI provider is configured.");
  }
}

export class AiProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderUnavailableError";
  }
}

export type StructuredAiProviderResponse = AiStructuredOutput;
