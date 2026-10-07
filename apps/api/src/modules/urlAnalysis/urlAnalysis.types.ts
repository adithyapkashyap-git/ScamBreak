import type { FindingInput } from "../analyses/analysis.types.js";

export type UrlSafetyIssue =
  | "invalid_url"
  | "unsupported_scheme"
  | "embedded_credentials"
  | "private_or_reserved_host"
  | "non_standard_port";

export type NormalizedUrl = {
  original: string;
  canonicalUrl: string;
  protocol: "http:" | "https:";
  hostname: string;
  unicodeHostname: string;
  port: string;
  pathname: string;
  search: string;
  isIpLiteral: boolean;
  safeForRemoteLookup: boolean;
  safetyIssues: UrlSafetyIssue[];
};

export type UrlThreatIntelResult = {
  provider: string;
  status: "available" | "unavailable" | "error";
  /** A provider may only claim a result it actually obtained. */
  verdict?: "malicious" | "suspicious" | "clean" | "unknown";
  reference?: string;
  observedAt?: Date;
};

export type UrlAnalysisResult = {
  normalized?: NormalizedUrl;
  findings: FindingInput[];
  providerResults: UrlThreatIntelResult[];
  limitations: string[];
};

export interface UrlThreatIntelProvider {
  readonly name: string;
  analyze(input: {
    canonicalUrl: string;
    hostname: string;
    /** True only after local SSRF checks; provider must still apply its own egress controls. */
    isPublicTarget: boolean;
  }): Promise<UrlThreatIntelResult>;
}

export type TrustedDomainCandidate = {
  name: string;
  officialDomains: string[];
};
