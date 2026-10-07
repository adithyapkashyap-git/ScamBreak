const sensitiveTokenPattern = /\b(?:otp|one[ -]?time(?:[ -]?pass(?:word|code))?|pin|cvv|cvc|password|passcode)\s*[:=-]?\s*\S+/gi;
const cardLikePattern = /\b(?:\d[ -]?){13,19}\b/g;
const longAccountPattern = /\b\d{9,18}\b/g;

export function redactSensitiveText(value: string, maximumLength = 180): string {
  const scrubbed = value
    .replace(sensitiveTokenPattern, "[sensitive credential removed]")
    .replace(cardLikePattern, "[payment number removed]")
    .replace(longAccountPattern, "[account number removed]")
    .replace(/\s+/g, " ")
    .trim();

  return scrubbed.length > maximumLength ? `${scrubbed.slice(0, maximumLength - 1)}…` : scrubbed;
}

export function redactIdentifier(value: string, visibleTail = 4): string {
  const compact = value.trim();
  if (compact.length <= visibleTail) return "••••";
  return `${"•".repeat(Math.min(8, compact.length - visibleTail))}${compact.slice(-visibleTail)}`;
}

export function safeExcerpt(text: string, start?: number, end?: number): string {
  const clipped = start === undefined ? text.slice(0, 180) : text.slice(Math.max(0, start - 48), Math.min(text.length, (end ?? start) + 96));
  return redactSensitiveText(clipped);
}
