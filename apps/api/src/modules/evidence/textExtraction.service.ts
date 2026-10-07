import { createHash } from "node:crypto";

import type { ExtractedEntityInput, EvidenceChannel, EvidenceType } from "../analyses/analysis.types.js";
import { redactIdentifier, redactSensitiveText } from "../analyses/dataSanitization.js";

export type TextExtractionInput = {
  evidencePublicId: string;
  type: EvidenceType;
  channel: EvidenceChannel;
  text: string;
  source?: "deterministic" | "ocr" | "ai" | "manual";
};

export type TextExtractionResult = {
  normalizedText: string;
  entities: ExtractedEntityInput[];
  languageHint?: string;
};

const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const phoneCandidatePattern = /(?<![\w@])(?:\+?\d[\d\s().-]{6,}\d)(?![\w@])/g;
const paymentHandlePattern = /\b[A-Z0-9._-]{2,128}@[A-Z][A-Z0-9.-]{1,63}\b/gi;
const amountPattern = /(?:₹|\$|€|£|\b(?:INR|USD|EUR|GBP|Rs\.?)\b)\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d{1,2})?/gi;
const deadlinePattern = /\b(?:within\s+(?:\d+\s+)?(?:minutes?|hours?|days?)|by\s+(?:today|tomorrow|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|immediately|urgent(?:ly)?|before\s+(?:midnight|your account is|it expires))\b/gi;
const requestedActionPattern = /\b(?:click(?:\s+the)?\s+link|open\s+(?:the\s+)?link|pay(?:\s+now)?|transfer(?:\s+money)?|send(?:\s+money)?|share\s+(?:your\s+)?(?:otp|pin|password|code)|verify\s+(?:your\s+)?account|install\s+(?:the\s+)?app|download\s+(?:the\s+)?app|call\s+(?:this\s+)?number|reply\s+(?:yes|now))\b/gi;
const organizationPattern = /\b(?:from|on behalf of|representing|team at)\s+([A-Z][A-Za-z0-9&.' -]{1,70}?)(?=\s*(?:,|\.|!|\?|is\b|has\b|will\b|asks?\b|requested\b|$))/g;

function trimUrl(value: string): string {
  return value.replace(/[),.;!?\]}]+$/g, "");
}

function displayFor(kind: ExtractedEntityInput["kind"], value: string): string {
  switch (kind) {
    case "phone":
    case "payment_handle":
    case "account_identifier":
      return redactIdentifier(value);
    case "email": {
      const [local, domain] = value.split("@");
      return `${(local ?? "").slice(0, 2)}•••@${domain ?? ""}`;
    }
    case "amount":
      return redactSensitiveText(value, 80);
    default:
      return redactSensitiveText(value, 180);
  }
}

function addEntity(
  output: ExtractedEntityInput[],
  input: TextExtractionInput,
  kind: ExtractedEntityInput["kind"],
  rawValue: string,
  startOffset: number,
  classification: ExtractedEntityInput["classification"],
): void {
  const value = rawValue.trim();
  if (!value) return;
  const normalizedValue = kind === "url" || kind === "domain" || kind === "email" ? value.toLowerCase() : value.replace(/\s+/g, " ").trim();
  if (output.some((entity) => entity.kind === kind && entity.normalizedValue === normalizedValue)) return;

  output.push({
    kind,
    value,
    normalizedValue,
    displayValue: displayFor(kind, value),
    classification,
    sourceEvidencePublicId: input.evidencePublicId,
    source: input.source ?? "deterministic",
    confidence: "strong",
    startOffset,
    endOffset: startOffset + rawValue.length,
  });
}

function getHostname(value: string): string | undefined {
  try {
    const safeCandidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(safeCandidate).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && !/^0+$/.test(digits);
}

function inferLanguage(text: string): string | undefined {
  if (/\p{Script=Devanagari}/u.test(text)) return "hi";
  if (/\p{Script=Arabic}/u.test(text)) return "ar";
  if (/\p{Script=Cyrillic}/u.test(text)) return "ru";
  if (/[A-Za-z]/.test(text)) return "en";
  return undefined;
}

/** Normalizes text without changing it into instructions or silently dropping content. */
export function normalizeEvidenceText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

/**
 * Deterministic entity extraction. It is intentionally conservative: values
 * become evidence for later checks, not a claim that a message is fraudulent.
 */
export function extractStructuredText(input: TextExtractionInput): TextExtractionResult {
  const normalizedText = normalizeEvidenceText(input.text);
  const entities: ExtractedEntityInput[] = [];

  for (const match of normalizedText.matchAll(urlPattern)) {
    const url = trimUrl(match[0]);
    addEntity(entities, input, "url", url, match.index ?? 0, "private");
    const hostname = getHostname(url);
    if (hostname) addEntity(entities, input, "domain", hostname, match.index ?? 0, "internal");
  }

  for (const match of normalizedText.matchAll(emailPattern)) {
    addEntity(entities, input, "email", match[0], match.index ?? 0, "private");
  }

  for (const match of normalizedText.matchAll(paymentHandlePattern)) {
    // Do not classify ordinary email addresses as payment handles.
    if (!match[0].includes(".")) addEntity(entities, input, "payment_handle", match[0], match.index ?? 0, "restricted");
  }

  for (const match of normalizedText.matchAll(phoneCandidatePattern)) {
    if (looksLikePhone(match[0])) addEntity(entities, input, "phone", match[0], match.index ?? 0, "restricted");
  }

  for (const match of normalizedText.matchAll(amountPattern)) {
    addEntity(entities, input, "amount", match[0], match.index ?? 0, "restricted");
  }

  for (const match of normalizedText.matchAll(deadlinePattern)) {
    addEntity(entities, input, "deadline", match[0], match.index ?? 0, "private");
  }

  for (const match of normalizedText.matchAll(requestedActionPattern)) {
    addEntity(entities, input, "requested_action", match[0], match.index ?? 0, "private");
  }

  for (const match of normalizedText.matchAll(organizationPattern)) {
    const claimed = match[1]?.trim();
    if (claimed && claimed.length >= 3) addEntity(entities, input, "organization", claimed, (match.index ?? 0) + match[0].indexOf(claimed), "private");
  }

  return { normalizedText, entities, languageHint: inferLanguage(normalizedText) };
}

/** A stable, keyed-ready hash input for exact restricted identifier matching. */
export function fingerprintNormalizedEntity(normalizedValue: string, pepper = ""): string {
  return createHash("sha256").update(`${pepper}\u0000${normalizedValue}`).digest("hex");
}
