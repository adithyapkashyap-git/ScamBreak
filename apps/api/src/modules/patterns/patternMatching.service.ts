import type { EvidenceChannel, ExtractedEntityInput, FindingInput } from "../analyses/analysis.types.js";
import type { PatternDefinition } from "./patternTaxonomy.js";

export type PatternMatch = {
  patternId: string;
  matchedIndicators: string[];
  finding: FindingInput;
};

function applicable(definition: PatternDefinition, channels: EvidenceChannel[]): boolean {
  if (channels.length === 0 || channels.includes("unknown")) return true;
  return definition.applicableChannels.includes("unknown") || channels.some((channel) => definition.applicableChannels.includes(channel));
}

/**
 * Matches only structured finding/entity signals. It does not interpret raw
 * messages, making the taxonomy reviewable and safe to change independently.
 */
export function matchScamPatterns(input: {
  findings: FindingInput[];
  entities: ExtractedEntityInput[];
  channels: EvidenceChannel[];
  evidencePublicIds: string[];
  definitions: PatternDefinition[];
}): PatternMatch[] {
  const detectedCodes = new Set(input.findings.filter((finding) => finding.state === "detected").map((finding) => finding.code));
  const entityKinds = new Set(input.entities.map((entity) => entity.kind));
  const evidencePublicId = input.evidencePublicIds[0] ?? "unknown";

  return input.definitions.flatMap((definition) => {
    if (!applicable(definition, input.channels)) return [];
    const required = definition.indicators.allFindingCodes ?? [];
    if (!required.every((code) => detectedCodes.has(code))) return [];

    const matchedFindingCodes = definition.indicators.anyFindingCodes.filter((code) => detectedCodes.has(code));
    const matchedEntityKinds = (definition.indicators.entityKinds ?? []).filter((kind) => entityKinds.has(kind as ExtractedEntityInput["kind"]));
    const matchedIndicators = [...matchedFindingCodes, ...matchedEntityKinds.map((kind) => `entity:${kind}`)];
    if (matchedIndicators.length < definition.indicators.minMatchedIndicators) return [];

    return [{
      patternId: definition.patternId,
      matchedIndicators,
      finding: {
        code: `pattern_${definition.patternId}`,
        category: "scam_pattern",
        state: "detected",
        severity: definition.severity,
        confidence: matchedIndicators.length >= definition.indicators.minMatchedIndicators + 1 ? "moderate" : "limited",
        title: `Pattern match: ${definition.name}`,
        explanation: `${definition.description} This is a pattern match based on the detected signals, not proof of the sender's identity or intent.`,
        evidence: [{ evidencePublicId, excerpt: `Matched signals: ${matchedIndicators.join(", ")}.` }],
        recommendedActionKeys: definition.recommendedProtectiveActions,
        patternIds: [definition.patternId],
        technicalDetails: { matchedIndicators },
        source: "pattern",
      },
    }];
  });
}
