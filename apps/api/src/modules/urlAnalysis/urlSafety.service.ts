import { domainToUnicode } from "node:url";
import { isIP } from "node:net";

import type { FindingInput } from "../analyses/analysis.types.js";
import type { NormalizedUrl, UrlSafetyIssue } from "./urlAnalysis.types.js";

const shortenerHosts = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "is.gd",
  "cutt.ly",
  "shorturl.at",
  "rebrand.ly",
  "tiny.one",
]);

const suspiciousPathTerms = /(?:login|signin|verify|verification|secure|account|wallet|payment|refund|kyc|update|invoice|gift|bonus|reward|unlock)/i;

function ipv4ToNumber(value: string): number | undefined {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  const numbers = parts.map(Number);
  if (numbers.some((part) => part < 0 || part > 255)) return undefined;
  return (((numbers[0]! << 24) >>> 0) + (numbers[1]! << 16) + (numbers[2]! << 8) + numbers[3]!) >>> 0;
}

/** Includes loopback, link-local, RFC1918, carrier-grade NAT, documentation and multicast ranges. */
export function isPrivateOrReservedIp(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host) === 4) {
    const numeric = ipv4ToNumber(host);
    if (numeric === undefined) return true;
    const inRange = (base: string, bits: number): boolean => {
      const baseNumeric = ipv4ToNumber(base)!;
      const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
      return (numeric & mask) === (baseNumeric & mask);
    };
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
      ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
      ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, bits]) => inRange(base as string, bits as number));
  }

  if (isIP(host) === 6) {
    // IPv4-mapped loopback/private addresses and IPv6 local/reserved ranges.
    return (
      host === "::" ||
      host === "::1" ||
      host.startsWith("::ffff:127.") ||
      host.startsWith("::ffff:10.") ||
      host.startsWith("::ffff:192.168.") ||
      /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^(?:fc|fd)[0-9a-f]{2}:/i.test(host) ||
      /^fe[89ab][0-9a-f]:/i.test(host) ||
      /^ff/i.test(host) ||
      /^2001:db8:/i.test(host)
    );
  }

  return false;
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home") ||
    host === "metadata.google.internal" ||
    host.endsWith(".cluster.local")
  );
}

/**
 * Parses a submitted URL without fetching it. Only http(s) is accepted and
 * potentially private targets are never eligible for provider/network lookup.
 */
export function normalizeSubmittedUrl(value: string): NormalizedUrl {
  const original = value.trim();
  if (!original || original.length > 4_096 || /[\u0000-\u001F\u007F\s]/.test(original)) {
    throw new UrlInputError("invalid_url", "The URL is malformed or too long.");
  }

  // Only add an HTTPS default to a bare hostname. An explicitly supplied
  // scheme such as file:, data:, javascript:, or ftp: must never be treated
  // as a hostname or passed toward a network/provider boundary.
  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(original);
  if (hasExplicitScheme && !/^https?:\/\//i.test(original)) {
    throw new UrlInputError("unsupported_scheme", "Only http and https URLs can be analyzed.");
  }

  let parsed: URL;
  try {
    parsed = new URL(hasExplicitScheme ? original : `https://${original}`);
  } catch {
    throw new UrlInputError("invalid_url", "The URL could not be parsed.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlInputError("unsupported_scheme", "Only http and https URLs can be analyzed.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const isIpLiteral = isIP(hostname.replace(/^\[|\]$/g, "")) !== 0;
  const safetyIssues: UrlSafetyIssue[] = [];
  if (parsed.username || parsed.password) safetyIssues.push("embedded_credentials");
  if (isLocalHostname(hostname) || (isIpLiteral && isPrivateOrReservedIp(hostname))) safetyIssues.push("private_or_reserved_host");
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") safetyIssues.push("non_standard_port");

  // Fragments are client-only and do not belong in canonical or provider input.
  parsed.hash = "";
  parsed.hostname = hostname;
  const safeForRemoteLookup = !safetyIssues.includes("private_or_reserved_host") && !safetyIssues.includes("embedded_credentials") && !safetyIssues.includes("non_standard_port") && !isIpLiteral;

  return {
    original,
    canonicalUrl: parsed.toString(),
    protocol: parsed.protocol,
    hostname,
    unicodeHostname: domainToUnicode(hostname),
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    isIpLiteral,
    safeForRemoteLookup,
    safetyIssues,
  };
}

export class UrlInputError extends Error {
  constructor(
    readonly code: UrlSafetyIssue,
    message: string,
  ) {
    super(message);
    this.name = "UrlInputError";
  }
}

function finding(input: {
  code: string;
  severity: FindingInput["severity"];
  confidence?: FindingInput["confidence"];
  title: string;
  explanation: string;
  evidencePublicId: string;
  technicalDetails?: Record<string, unknown>;
  actionKeys?: string[];
}): FindingInput {
  return {
    code: input.code,
    category: "url_domain",
    state: "detected",
    severity: input.severity,
    confidence: input.confidence ?? "strong",
    title: input.title,
    explanation: input.explanation,
    evidence: [{ evidencePublicId: input.evidencePublicId, excerpt: "A URL was supplied for analysis.", entityKinds: ["url", "domain"] }],
    recommendedActionKeys: input.actionKeys ?? ["do_not_click", "contact_independently"],
    technicalDetails: input.technicalDetails,
    source: "url",
  };
}

export function evaluateStaticUrlSignals(normalized: NormalizedUrl, evidencePublicId: string): FindingInput[] {
  const findings: FindingInput[] = [];
  if (normalized.protocol === "http:") {
    findings.push(finding({
      code: "url_not_https",
      severity: "low",
      title: "The link does not use HTTPS",
      explanation: "The link uses HTTP rather than encrypted HTTPS. This alone does not prove fraud, but it is a reason for caution.",
      evidencePublicId,
      technicalDetails: { protocol: normalized.protocol },
    }));
  }
  if (normalized.hostname.includes("xn--")) {
    findings.push(finding({
      code: "url_punycode_idn",
      severity: "high",
      title: "The link uses an internationalized domain encoding",
      explanation: "Punycode can be legitimate, but it can also make a lookalike address harder to notice. Verify the official domain independently.",
      evidencePublicId,
      technicalDetails: { hostname: normalized.hostname, unicodeHostname: normalized.unicodeHostname },
    }));
  }
  if (shortenerHosts.has(normalized.hostname)) {
    findings.push(finding({
      code: "url_shortener",
      severity: "medium",
      title: "The link is shortened",
      explanation: "A shortened link hides its final destination. Do not open it until the destination has been independently verified.",
      evidencePublicId,
      technicalDetails: { hostname: normalized.hostname },
    }));
  }
  if (normalized.isIpLiteral) {
    findings.push(finding({
      code: "url_ip_literal",
      severity: "high",
      title: "The link uses an IP address instead of a normal domain",
      explanation: "Links that use an IP address rather than an organization domain deserve extra scrutiny.",
      evidencePublicId,
      technicalDetails: { hostname: normalized.hostname },
    }));
  }
  if (normalized.safetyIssues.includes("private_or_reserved_host")) {
    findings.push(finding({
      code: "url_private_target_blocked",
      severity: "high",
      title: "The link targets a private or reserved network address",
      explanation: "ScamBreak did not send this link to an external checker because it could target an internal service.",
      evidencePublicId,
      technicalDetails: { hostname: normalized.hostname },
      actionKeys: ["do_not_click"],
    }));
  }
  if (normalized.safetyIssues.includes("embedded_credentials")) {
    findings.push(finding({
      code: "url_embedded_credentials",
      severity: "high",
      title: "The link contains embedded username or password text",
      explanation: "Credentials embedded in a URL are unusual and can obscure the real destination.",
      evidencePublicId,
      technicalDetails: { hostname: normalized.hostname },
    }));
  }
  if (normalized.safetyIssues.includes("non_standard_port")) {
    findings.push(finding({
      code: "url_non_standard_port",
      severity: "medium",
      title: "The link uses an unusual network port",
      explanation: "The link uses a port other than the usual web ports. ScamBreak did not fetch it automatically.",
      evidencePublicId,
      technicalDetails: { port: normalized.port },
    }));
  }

  const labels = normalized.hostname.split(".");
  if (labels.length >= 5) {
    findings.push(finding({
      code: "url_excessive_subdomains",
      severity: "medium",
      title: "The link has many subdomains",
      explanation: "Long subdomain chains can make a misleading domain look official at a glance.",
      evidencePublicId,
      technicalDetails: { subdomainCount: labels.length - 2 },
    }));
  }
  if (suspiciousPathTerms.test(`${normalized.pathname}${normalized.search}`)) {
    findings.push(finding({
      code: "url_sensitive_theme",
      severity: "low",
      confidence: "limited",
      title: "The link path refers to an account, payment, or verification action",
      explanation: "This theme is common in both genuine and fraudulent links. Use an independently found official site or app instead of this link.",
      evidencePublicId,
      technicalDetails: { pathname: normalized.pathname.slice(0, 300) },
    }));
  }
  if (/%(?:2f|5c|40|00)/i.test(normalized.canonicalUrl) || normalized.canonicalUrl.length > 1_500) {
    findings.push(finding({
      code: "url_obfuscation_pattern",
      severity: "medium",
      title: "The link contains an obfuscation pattern",
      explanation: "Encoded separators or an unusually long URL can make its destination harder to inspect.",
      evidencePublicId,
      technicalDetails: { encoded: true },
    }));
  }
  return findings;
}
