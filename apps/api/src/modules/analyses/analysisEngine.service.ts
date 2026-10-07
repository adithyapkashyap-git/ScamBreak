import type { AiAnalysisProvider } from "../ai/aiProvider.js";
import { UnavailableAiProvider } from "../ai/aiProvider.js";
import { aiOutputToEntities, aiOutputToFindings, runAiAnalysis } from "../ai/aiSafety.service.js";
import type { EntityVerificationService } from "../entities/entityVerification.service.js";
import { extractStructuredText } from "../evidence/textExtraction.service.js";
import { evaluateTextSignals } from "../evidence/textSignals.service.js";
import { matchScamPatterns } from "../patterns/patternMatching.service.js";
import { builtInPatternTaxonomy, type PatternDefinition } from "../patterns/patternTaxonomy.js";
import { UrlAnalysisService } from "../urlAnalysis/urlAnalysis.service.js";
import type { UrlAnalysisResult } from "../urlAnalysis/urlAnalysis.types.js";
import type { AnalysisResult, EvidenceChannel, EvidenceType, ExtractedEntityInput, FindingInput } from "./analysis.types.js";
import { buildSafeActionPlan, buildVerificationGuidance } from "./guidance.service.js";
import { defaultRiskScoringConfig, scoreFindings, type RiskScoringConfig } from "./riskScoring.service.js";

export type EngineEvidence = {
  publicId: string;
  type: EvidenceType;
  channel: EvidenceChannel;
  text?: string;
  submittedUrl?: string;
  /** OCR text is distinct from user-entered text and keeps its provenance. */
  ocrText?: string;
};

export type AnalysisPipelineResult = AnalysisResult & {
  entities: ExtractedEntityInput[];
  urlResults: Array<{ evidencePublicId: string; result: UrlAnalysisResult }>;
  aiStatus: "available" | "disabled" | "unavailable" | "invalid" | "error";
};

export type AnalysisEngineOptions = {
  urlAnalysisService?: UrlAnalysisService;
  entityVerificationService?: EntityVerificationService;
  aiProvider?: AiAnalysisProvider;
  patternDefinitions?: PatternDefinition[];
  riskScoringConfig?: RiskScoringConfig;
  engineVersion?: string;
};

const severityRank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
const confidenceRank = { limited: 0, moderate: 1, strong: 2 } as const;

function mergeFindings(findings: FindingInput[]): FindingInput[] {
  const grouped = new Map<string, FindingInput>();
  for (const finding of findings) {
    const existing = grouped.get(finding.code);
    if (!existing) {
      grouped.set(finding.code, { ...finding, evidence: [...finding.evidence], recommendedActionKeys: [...finding.recommendedActionKeys], patternIds: finding.patternIds ? [...finding.patternIds] : undefined });
      continue;
    }
    const isDetected = existing.state === "detected" || finding.state === "detected";
    const stronger = severityRank[finding.severity] > severityRank[existing.severity] ? finding : existing;
    const moreCertain = confidenceRank[finding.confidence] > confidenceRank[existing.confidence] ? finding : existing;
    grouped.set(finding.code, {
      ...existing,
      state: isDetected ? "detected" : existing.state,
      severity: stronger.severity,
      confidence: moreCertain.confidence,
      title: stronger.title,
      explanation: stronger.explanation,
      evidence: [...existing.evidence, ...finding.evidence].filter((entry, index, all) => all.findIndex((candidate) => candidate.evidencePublicId === entry.evidencePublicId && candidate.excerpt === entry.excerpt) === index),
      recommendedActionKeys: [...new Set([...existing.recommendedActionKeys, ...finding.recommendedActionKeys])],
      patternIds: [...new Set([...(existing.patternIds ?? []), ...(finding.patternIds ?? [])])],
    });
  }
  return [...grouped.values()];
}

function dedupeEntities(entities: ExtractedEntityInput[]): ExtractedEntityInput[] {
  const entries = new Map<string, ExtractedEntityInput>();
  for (const entity of entities) {
    const key = `${entity.sourceEvidencePublicId}:${entity.kind}:${entity.normalizedValue.toLowerCase()}`;
    const prior = entries.get(key);
    if (!prior || confidenceRank[entity.confidence] > confidenceRank[prior.confidence]) entries.set(key, entity);
  }
  return [...entries.values()];
}

/**
 * Coordinates independent analyzers. No analyzer can execute a URL, invoke a
 * privileged operation, or turn an AI response into an unvalidated action.
 */
export class AnalysisEngine {
  private readonly urlAnalysisService: UrlAnalysisService;
  private readonly aiProvider: AiAnalysisProvider;
  private readonly definitions: PatternDefinition[];
  private readonly riskConfig: RiskScoringConfig;
  private readonly engineVersion: string;

  constructor(private readonly options: AnalysisEngineOptions = {}) {
    this.urlAnalysisService = options.urlAnalysisService ?? new UrlAnalysisService();
    this.aiProvider = options.aiProvider ?? new UnavailableAiProvider();
    this.definitions = options.patternDefinitions ?? builtInPatternTaxonomy;
    this.riskConfig = options.riskScoringConfig ?? defaultRiskScoringConfig;
    this.engineVersion = options.engineVersion ?? "analysis-engine/1.0.0";
  }

  async analyze(input: { evidence: EngineEvidence[]; locale: string; allowExternalAiProcessing?: boolean }): Promise<AnalysisPipelineResult> {
    const allEntities: ExtractedEntityInput[] = [];
    const allFindings: FindingInput[] = [];
    const limitations: string[] = [];
    const urlResults: AnalysisPipelineResult["urlResults"] = [];
    const aiEvidence: Array<{ publicId: string; type: EngineEvidence["type"]; channel: EngineEvidence["channel"]; text: string }> = [];

    for (const evidence of input.evidence) {
      const availableText = evidence.ocrText ?? evidence.text ?? evidence.submittedUrl;
      if (availableText) {
        const source = evidence.ocrText ? "ocr" : "deterministic";
        const extraction = extractStructuredText({ evidencePublicId: evidence.publicId, type: evidence.type, channel: evidence.channel, text: availableText, source });
        allEntities.push(...extraction.entities);
        allFindings.push(...evaluateTextSignals({
          evidencePublicId: evidence.publicId,
          text: extraction.normalizedText,
          hasUrl: extraction.entities.some((entity) => entity.kind === "url"),
          hasPaymentHandle: extraction.entities.some((entity) => entity.kind === "payment_handle"),
        }));
        aiEvidence.push({ publicId: evidence.publicId, type: evidence.type, channel: evidence.channel, text: extraction.normalizedText });
      } else if (evidence.type === "image") {
        limitations.push(`Screenshot ${evidence.publicId} was preserved, but no OCR text was available for automated extraction.`);
      }
    }

    let trustedDomains: Array<{ name: string; officialDomains: string[] }> = [];
    if (this.options.entityVerificationService) {
      try {
        trustedDomains = await this.options.entityVerificationService.findUrlCandidates();
      } catch {
        limitations.push("The trusted-entity directory was unavailable, so no domain comparison was claimed.");
      }
    }

    const urlCandidates = new Map<string, string>();
    for (const entity of allEntities.filter((item) => item.kind === "url")) urlCandidates.set(`${entity.sourceEvidencePublicId}:${entity.value}`, entity.sourceEvidencePublicId);
    for (const evidence of input.evidence) {
      if (evidence.submittedUrl) urlCandidates.set(`${evidence.publicId}:${evidence.submittedUrl}`, evidence.publicId);
    }
    for (const [key, evidencePublicId] of urlCandidates) {
      const url = key.slice(evidencePublicId.length + 1);
      const result = await this.urlAnalysisService.analyze({ url, evidencePublicId, trustedDomains });
      urlResults.push({ evidencePublicId, result });
      allFindings.push(...result.findings);
      limitations.push(...result.limitations);
    }

    // A directory match changes verification guidance, never a legitimacy verdict.
    if (this.options.entityVerificationService) {
      for (const entity of allEntities.filter((item) => item.kind === "organization").slice(0, 8)) {
        const sameEvidenceDomain = allEntities.find((candidate) => candidate.sourceEvidencePublicId === entity.sourceEvidencePublicId && candidate.kind === "domain")?.normalizedValue;
        try {
          const verification = await this.options.entityVerificationService.verifyClaim(entity.value, sameEvidenceDomain);
          if (verification.status === "known_entity_unverified_claim" && sameEvidenceDomain) {
            allFindings.push({
              code: "claimed_entity_domain_mismatch",
              category: "impersonation",
              state: "detected",
              severity: "high",
              confidence: "moderate",
              title: "The supplied domain does not match a listed official domain",
              explanation: "The organization name resembles a trusted entity, but the submitted domain is not in that entity's verified official-domain list. This needs independent verification.",
              evidence: [{ evidencePublicId: entity.sourceEvidencePublicId, excerpt: "A claimed organization and submitted domain were compared with a trusted-entity directory.", entityKinds: ["organization", "domain"] }],
              recommendedActionKeys: ["do_not_click", "open_official_app", "contact_independently"],
              source: "verification",
            });
          }
        } catch {
          limitations.push("A claimed organization could not be checked against the trusted-entity directory.");
        }
      }
    }

    const aiRun = await runAiAnalysis({
      provider: this.aiProvider,
      allowExternalProcessing: input.allowExternalAiProcessing ?? false,
      locale: input.locale,
      evidence: aiEvidence,
    });
    limitations.push(...aiRun.limitations);
    if (aiRun.output) {
      allEntities.push(...aiOutputToEntities(aiRun.output, aiEvidence));
      allFindings.push(...aiOutputToFindings(aiRun.output, aiEvidence));
    }

    const entities = dedupeEntities(allEntities);
    const initialFindings = mergeFindings(allFindings);
    const patternMatches = matchScamPatterns({
      findings: initialFindings,
      entities,
      channels: input.evidence.map((item) => item.channel),
      evidencePublicIds: input.evidence.map((item) => item.publicId),
      definitions: this.definitions,
    });
    const findings = mergeFindings([...initialFindings, ...patternMatches.map((match) => match.finding)]);
    const risk = scoreFindings(findings, this.riskConfig, this.engineVersion);

    return {
      entities,
      findings,
      risk,
      safeActions: buildSafeActionPlan(findings),
      verificationSteps: buildVerificationGuidance(findings),
      matchedPatternIds: patternMatches.map((match) => match.patternId),
      limitations: [...new Set([...limitations, ...risk.limitations])],
      urlResults,
      aiStatus: aiRun.status,
    };
  }
}
