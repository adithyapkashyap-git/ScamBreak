import type { FindingInput } from "../analyses/analysis.types.js";
import type { TrustedDomainCandidate, UrlAnalysisResult, UrlThreatIntelProvider, UrlThreatIntelResult } from "./urlAnalysis.types.js";
import { evaluateStaticUrlSignals, normalizeSubmittedUrl, UrlInputError } from "./urlSafety.service.js";

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = previous[j]!;
      previous[j] = Math.min(previous[j]! + 1, previous[j - 1]! + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = saved;
    }
  }
  return previous[right.length]!;
}

function rootLabel(hostname: string): string {
  const parts = hostname.split(".");
  return parts.length >= 2 ? parts[parts.length - 2]! : hostname;
}

function lookalikeFindings(evidencePublicId: string, hostname: string, candidates: TrustedDomainCandidate[]): FindingInput[] {
  const currentLabel = rootLabel(hostname).replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (currentLabel.length < 4) return [];
  for (const candidate of candidates) {
    for (const officialDomain of candidate.officialDomains) {
      const officialHost = officialDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (hostname === officialHost || hostname.endsWith(`.${officialHost}`)) continue;
      const officialLabel = rootLabel(officialHost).replace(/[^a-z0-9]/gi, "");
      const distance = editDistance(currentLabel, officialLabel);
      const threshold = officialLabel.length >= 8 ? 2 : 1;
      if (distance <= threshold) {
        return [{
          code: "url_possible_brand_lookalike",
          category: "url_domain",
          state: "detected",
          severity: "high",
          confidence: "limited",
          title: `The domain may resemble ${candidate.name}'s official domain`,
          explanation: "The domain name is similar to a trusted entity's domain but does not match its listed official domains. Similarity is not proof; verify using the official site found independently.",
          evidence: [{ evidencePublicId, excerpt: "A supplied URL was compared with an official-domain list.", entityKinds: ["url", "domain"] }],
          recommendedActionKeys: ["do_not_click", "open_official_app", "contact_independently"],
          technicalDetails: { hostname, comparedOfficialDomain: officialHost, editDistance: distance },
          source: "verification",
        }];
      }
    }
  }
  return [];
}

export class UrlAnalysisService {
  constructor(private readonly providers: UrlThreatIntelProvider[] = []) {}

  async analyze(input: {
    url: string;
    evidencePublicId: string;
    trustedDomains?: TrustedDomainCandidate[];
  }): Promise<UrlAnalysisResult> {
    let normalized;
    try {
      normalized = normalizeSubmittedUrl(input.url);
    } catch (error) {
      if (!(error instanceof UrlInputError)) throw error;
      return {
        findings: [{
          code: error.code,
          category: "url_domain",
          state: "unknown",
          severity: "info",
          confidence: "strong",
          title: "The supplied URL could not be safely analyzed",
          explanation: error.message,
          evidence: [{ evidencePublicId: input.evidencePublicId, excerpt: "A URL was supplied but was not parseable as a safe web URL.", entityKinds: ["url"] }],
          recommendedActionKeys: ["do_not_click"],
          source: "url",
        }],
        providerResults: [],
        limitations: ["No network request was made for the malformed or unsupported URL."],
      };
    }

    const findings = [
      ...evaluateStaticUrlSignals(normalized, input.evidencePublicId),
      ...lookalikeFindings(input.evidencePublicId, normalized.hostname, input.trustedDomains ?? []),
    ];
    const limitations: string[] = [];
    const providerResults: UrlThreatIntelResult[] = [];

    if (!normalized.safeForRemoteLookup) {
      limitations.push("External URL checks were intentionally skipped because the URL was not safe for server-side lookup.");
    } else if (this.providers.length === 0) {
      limitations.push("No external reputation provider is configured, so no reputation result is claimed.");
    } else {
      for (const provider of this.providers) {
        try {
          const result = await provider.analyze({ canonicalUrl: normalized.canonicalUrl, hostname: normalized.hostname, isPublicTarget: true });
          providerResults.push(result);
          if (result.status === "available" && result.verdict && result.verdict !== "clean" && result.verdict !== "unknown") {
            findings.push({
              code: `url_intel_${result.provider.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
              category: "url_reputation",
              state: "detected",
              severity: result.verdict === "malicious" ? "critical" : "high",
              confidence: "moderate",
              title: "An external reputation provider flagged this URL",
              explanation: `A configured provider returned a ${result.verdict} result. This is external intelligence, not a guarantee about the site.`,
              evidence: [{ evidencePublicId: input.evidencePublicId, excerpt: "A supplied URL was checked by a configured reputation provider.", entityKinds: ["url", "domain"] }],
              recommendedActionKeys: ["do_not_click", "preserve_evidence"],
              technicalDetails: { provider: result.provider, verdict: result.verdict, reference: result.reference },
              source: "url",
            });
          }
        } catch {
          providerResults.push({ provider: provider.name, status: "error" });
          limitations.push(`${provider.name} did not return a usable URL-reputation result.`);
        }
      }
    }

    return { normalized, findings, providerResults, limitations };
  }
}
