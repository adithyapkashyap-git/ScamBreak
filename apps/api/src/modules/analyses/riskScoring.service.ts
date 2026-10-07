import type { ConfidenceLevel, FindingInput, FindingSeverity, RiskAssessmentInput, RiskLevel } from "./analysis.types.js";

export type RiskScoringConfig = {
  version: string;
  severityPoints: Record<FindingSeverity, number>;
  confidenceMultiplier: Record<ConfidenceLevel, number>;
  thresholds: { low: number; medium: number; high: number; critical: number };
  /** Prevent a taxonomy match from double-counting every underlying signal. */
  maxPatternPoints: number;
  /** Individual code weights can be tuned from reviewed configuration. */
  overrides: Record<string, number>;
};

export const defaultRiskScoringConfig: RiskScoringConfig = {
  version: "risk-score/1.0.0",
  severityPoints: { info: 0, low: 6, medium: 15, high: 30, critical: 55 },
  confidenceMultiplier: { limited: 0.45, moderate: 0.75, strong: 1 },
  thresholds: { low: 1, medium: 20, high: 45, critical: 80 },
  maxPatternPoints: 10,
  overrides: {
    credential_or_otp_request: 65,
    remote_access_request: 65,
    url_private_target_blocked: 35,
    url_embedded_credentials: 35,
  },
};

const independentSources = new Set(["rule", "url", "verification", "pattern"]);

function riskLevel(score: number, findings: FindingInput[], thresholds: RiskScoringConfig["thresholds"]): RiskLevel {
  const criticalDirect = findings.some((finding) => finding.state === "detected" && finding.severity === "critical" && finding.confidence !== "limited");
  if (criticalDirect || score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  if (score >= thresholds.low) return "low";
  return "unclear";
}

function assessmentConfidence(detected: FindingInput[]): ConfidenceLevel {
  const evidenceBearing = detected.filter((finding) => finding.evidence.length > 0);
  const categories = new Set(evidenceBearing.map((finding) => finding.category));
  const sources = new Set(evidenceBearing.filter((finding) => independentSources.has(finding.source)).map((finding) => finding.source));
  if (evidenceBearing.length >= 3 && categories.size >= 2 && sources.size >= 1) return "strong";
  if (evidenceBearing.length >= 1) return "moderate";
  return "limited";
}

/**
 * Deterministic, versioned score. It is an indicator prioritization tool—not a
 * probability of fraud—and it never turns an absence of findings into a claim
 * that the content is legitimate.
 */
export function scoreFindings(
  findings: FindingInput[],
  config: RiskScoringConfig = defaultRiskScoringConfig,
  engineVersion = "analysis-engine/1.0.0",
): RiskAssessmentInput {
  const seen = new Set<string>();
  let points = 0;
  let patternPoints = 0;
  const contributions: RiskAssessmentInput["contributions"] = [];
  const detected = findings.filter((finding) => finding.state === "detected");

  for (const finding of detected) {
    if (seen.has(finding.code)) continue;
    seen.add(finding.code);
    const configuredBase = config.overrides[finding.code] ?? config.severityPoints[finding.severity];
    let contribution = Math.round(configuredBase * config.confidenceMultiplier[finding.confidence]);
    if (finding.source === "ai") contribution = Math.min(contribution, 8);
    if (finding.source === "pattern") {
      contribution = Math.min(contribution, Math.max(0, config.maxPatternPoints - patternPoints));
      patternPoints += contribution;
    }
    if (contribution <= 0) continue;
    points += contribution;
    contributions.push({ findingCode: finding.code, points: contribution, reason: finding.title });
  }

  const score = Math.min(100, points);
  const level = detected.length === 0 ? "unclear" : riskLevel(score, detected, config.thresholds);
  const strongest = [...detected]
    .sort((left, right) => (config.severityPoints[right.severity] - config.severityPoints[left.severity]) || (right.evidence.length - left.evidence.length))
    .slice(0, 4);
  const rationale = strongest.map((finding) => finding.explanation);
  const limitations = [
    "This risk score prioritizes detected signals; it is not a statistically validated probability of fraud.",
    "No result can prove that a sender, website, or organization is legitimate.",
  ];
  if (!findings.some((finding) => finding.source === "url")) limitations.push("No URL-specific result was available because no usable URL was submitted or analyzed.");
  if (!findings.some((finding) => finding.source === "ai")) limitations.push("No AI-derived conclusion was required for this assessment; deterministic signals were used where available.");

  return {
    level,
    score: detected.length === 0 ? null : score,
    confidence: assessmentConfidence(detected),
    rationale: rationale.length > 0 ? rationale : ["No decisive scam indicator was detected in the submitted evidence."],
    limitations,
    engineVersion,
    scoringConfigVersion: config.version,
    contributions,
  };
}
