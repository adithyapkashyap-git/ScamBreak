import type {
  AnalysisFinding,
  AnalysisResult,
  CreateAnalysisPayload,
  EvidenceInput,
  ExtractedEntity,
  FindingSeverity,
  IncidentInteraction,
  RecommendedAction,
  RiskLevel,
  VerificationGuidance,
} from '../types/analysis';
import { newClientId } from './ids';

type Confidence = 'high' | 'medium' | 'low';

interface RuleHit {
  category: AnalysisFinding['category'];
  title: string;
  severity: FindingSeverity;
  weight: number;
  confidence: Confidence;
  explanation: string;
  evidence: string[];
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const AMOUNT_PATTERN = /(?:₹|\$|€|£)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:INR|USD|EUR|GBP)\b/gi;

const BRANDS: Array<{ name: string; domains: string[]; aliases: RegExp }> = [
  { name: 'PayPal', domains: ['paypal.com'], aliases: /\bpaypal\b/i },
  { name: 'Microsoft', domains: ['microsoft.com', 'live.com', 'outlook.com'], aliases: /\bmicrosoft\b/i },
  { name: 'Google', domains: ['google.com', 'gmail.com'], aliases: /\bgoogle\b/i },
  { name: 'Amazon', domains: ['amazon.com', 'amazon.in'], aliases: /\bamazon\b/i },
  { name: 'Apple', domains: ['apple.com', 'icloud.com'], aliases: /\bapple\b/i },
  { name: 'Netflix', domains: ['netflix.com'], aliases: /\bnetflix\b/i },
];

function cleanUrl(value: string): string {
  return value.replace(/[),.!?;:]+$/, '');
}

function urlDomain(value: string): string | undefined {
  try {
    const normalized = value.startsWith('www.') ? `https://${value}` : value;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function textForEvidence(evidence: EvidenceInput): string {
  const structured = evidence.metadata ? Object.values(evidence.metadata).filter(Boolean).join(' ') : '';
  return [evidence.content, structured].filter(Boolean).join(' ');
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function displayEvidence(evidence: EvidenceInput): AnalysisResult['evidence'][number] {
  if (evidence.kind === 'image') {
    return {
      kind: 'image',
      label: evidence.originalFilename ? `Screenshot: ${evidence.originalFilename}` : 'Screenshot upload',
      status: 'unavailable',
    };
  }
  const labels: Record<Exclude<EvidenceInput['kind'], 'image'>, string> = {
    text: 'Pasted message',
    url: 'Submitted URL',
    email: 'Copied email',
    structured: 'Manual details',
  };
  return { kind: evidence.kind, label: labels[evidence.kind], status: 'processed' };
}

function extractEntities(evidence: EvidenceInput[]): ExtractedEntity[] {
  const source = evidence.map(textForEvidence).join('\n');
  const entities: ExtractedEntity[] = [];
  const urls = unique((source.match(URL_PATTERN) ?? []).map(cleanUrl));
  urls.forEach((value) => {
    entities.push({ type: 'url', value, normalizedValue: value, confidence: 0.98, privacyClass: 'private' });
    const domain = urlDomain(value);
    if (domain) entities.push({ type: 'domain', value: domain, normalizedValue: domain, confidence: 0.98, privacyClass: 'private' });
  });
  unique(source.match(EMAIL_PATTERN) ?? []).forEach((value) => {
    entities.push({ type: 'email', value, normalizedValue: value.toLowerCase(), confidence: 0.9, privacyClass: 'private' });
  });
  unique(source.match(PHONE_PATTERN) ?? []).forEach((value) => {
    entities.push({ type: 'phone', value, normalizedValue: value.replace(/\D/g, ''), confidence: 0.7, privacyClass: 'private' });
  });
  unique(source.match(AMOUNT_PATTERN) ?? []).forEach((value) => {
    entities.push({ type: 'amount', value, confidence: 0.75, privacyClass: 'private' });
  });
  evidence.forEach((item) => {
    const details = item.metadata;
    if (!details) return;
    if (details.claimedOrganization) entities.push({ type: 'organization', value: details.claimedOrganization, confidence: 0.8, privacyClass: 'private' });
    if (details.sender) entities.push({ type: 'other', value: details.sender, confidence: 0.7, privacyClass: 'private' });
    if (details.paymentDestination) entities.push({ type: 'payment_destination', value: details.paymentDestination, confidence: 0.85, privacyClass: 'restricted' });
    if (details.deadline) entities.push({ type: 'deadline', value: details.deadline, confidence: 0.8, privacyClass: 'private' });
  });
  return entities;
}

function makeHit(
  category: RuleHit['category'],
  title: string,
  severity: FindingSeverity,
  weight: number,
  confidence: Confidence,
  explanation: string,
  evidence: string[],
): RuleHit {
  return { category, title, severity, weight, confidence, explanation, evidence };
}

function ruleHits(source: string, entities: ExtractedEntity[]): RuleHit[] {
  const hits: RuleHit[] = [];
  const clipped = (match: string) => `Detected language: “${match.slice(0, 92)}${match.length > 92 ? '…' : ''}”`;
  const urgency = source.match(/(?:act now|immediately|urgent|within \d+ (?:minutes|hours)|today only|last warning|final notice|account (?:will be )?(?:blocked|suspended)|expires? (?:today|soon))/i);
  if (urgency) hits.push(makeHit('urgency', 'Pressure to act quickly', 'medium', 14, 'high', 'The content uses time pressure. Legitimate organizations normally allow you to verify a request independently.', [clipped(urgency[0])]));

  const credentials = source.match(/(?:one[- ]?time (?:password|code)|\botp\b|verification code|password|passcode|pin\b|security code)/i);
  if (credentials) hits.push(makeHit('credential_request', 'Possible credential or code request', 'critical', 32, 'high', 'The content refers to credentials or one-time codes. A genuine provider should not ask you to share these in a message or call.', [clipped(credentials[0])]));

  const financial = source.match(/(?:pay(?:ment)?|transfer|send (?:money|funds)|upi|gift card|crypto(?:currency)?|wallet address|bank (?:account|details)|deposit|fee|refund processing)/i);
  if (financial || entities.some((entity) => entity.type === 'payment_destination')) {
    const sample = financial?.[0] ?? 'payment destination supplied manually';
    hits.push(makeHit('payment_request', 'Payment-related instruction', 'high', 24, 'high', 'A payment request appears in the evidence. Do not send money or use a payment destination until you verify the claim through an independent channel.', [clipped(sample)]));
  }

  const remote = source.match(/(?:install (?:this |the )?(?:app|application)|download (?:anydesk|teamviewer|remote)|remote (?:access|support)|share (?:your )?screen|screen ?share)/i);
  if (remote) hits.push(makeHit('remote_access', 'Remote access or screen-sharing request', 'critical', 30, 'high', 'Remote-access requests can allow an attacker to view or control your device. Treat this as high risk until independently verified.', [clipped(remote[0])]));

  const secrecy = source.match(/(?:do not tell|keep (?:this )?secret|do not contact|avoid (?:the )?bank|do not discuss)/i);
  if (secrecy) hits.push(makeHit('secrecy', 'Instruction to bypass normal verification', 'medium', 13, 'high', 'The content discourages independent verification, which is a common social-engineering tactic.', [clipped(secrecy[0])]));

  const sensitive = source.match(/(?:card number|cvv|date of birth|aadhaar|social security|identity (?:card|document)|bank login)/i);
  if (sensitive) hits.push(makeHit('sensitive_data', 'Sensitive personal or financial data request', 'high', 24, 'high', 'Sensitive information is referenced. Do not provide identity, card, or account details through an unverified channel.', [clipped(sensitive[0])]));

  const impersonation = source.match(/(?:customer care|fraud (?:department|team)|tax (?:department|office)|police|bank (?:support|security)|delivery (?:team|service)|government (?:office|agency))/i);
  if (impersonation) hits.push(makeHit('impersonation', 'Authority or service impersonation signal', 'medium', 16, 'medium', 'The sender appears to invoke an institution or service role. This is not proof of identity; verify through contact details you obtain independently.', [clipped(impersonation[0])]));

  const domains = entities.filter((entity) => entity.type === 'domain').map((entity) => entity.value);
  const urls = entities.filter((entity) => entity.type === 'url').map((entity) => entity.value);
  urls.forEach((value) => {
    const domain = urlDomain(value);
    if (!domain) return;
    const reason: string[] = [];
    let severity: FindingSeverity = 'low';
    let weight = 0;
    if (domain.includes('xn--')) {
      reason.push('contains an internationalized (punycode) hostname');
      severity = 'high';
      weight += 22;
    }
    if (/^(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|shorturl\.at)$/i.test(domain)) {
      reason.push('uses a link-shortening service');
      severity = severity === 'high' ? severity : 'medium';
      weight += 12;
    }
    if (/(?:login|verify|secure|update|reward|claim|invoice|refund)/i.test(value)) {
      reason.push('uses account or verification wording in the address');
      weight += 8;
    }
    if (reason.length) hits.push(makeHit('url_risk', 'URL needs independent verification', severity, weight || 8, 'medium', `The URL ${reason.join(' and ')}. This is a defensive heuristic, not a reputation lookup.`, [`Submitted domain: ${domain}`]));
  });

  BRANDS.forEach((brand) => {
    if (!brand.aliases.test(source) || domains.length === 0) return;
    const hasOfficialDomain = domains.some((domain) => brand.domains.some((official) => domain === official || domain.endsWith(`.${official}`)));
    if (!hasOfficialDomain) {
      hits.push(makeHit('impersonation', `${brand.name} claim does not match submitted domain`, 'high', 25, 'medium', `The evidence mentions ${brand.name}, but the submitted URL is not one of the expected official domains. This does not verify who sent the message.`, [`Claimed brand: ${brand.name}`, `Submitted domain: ${domains[0]}`]));
    }
  });
  return hits;
}

function scoreRisk(hits: RuleHit[]): { score: number; level: RiskLevel; confidence: Confidence } {
  const score = Math.min(100, hits.reduce((total, hit) => total + hit.weight, 0));
  const level: RiskLevel = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : score > 0 ? 'low' : 'unclear';
  const confidence: Confidence = hits.length >= 3 || hits.some((hit) => hit.severity === 'critical') ? 'high' : hits.length ? 'medium' : 'low';
  return { score, level, confidence };
}

function actionsFor(hits: RuleHit[]): RecommendedAction[] {
  const categories = new Set(hits.map((hit) => hit.category));
  const actions: RecommendedAction[] = [
    {
      id: 'pause',
      priority: 'do_now',
      title: 'Pause before responding, clicking, or paying',
      description: 'Do not use any link, contact detail, or payment destination supplied in the suspicious content until you verify the claim independently.',
    },
  ];
  if (categories.has('credential_request') || categories.has('sensitive_data')) actions.push({
    id: 'credentials', priority: 'do_now', title: 'Keep credentials and codes private', description: 'Do not share passwords, one-time codes, PINs, card security codes, or identity documents. If you already shared a password, change it from the official site or app.'
  });
  if (categories.has('payment_request')) actions.push({
    id: 'payment', priority: 'do_now', title: 'Do not send money', description: 'If money was already sent, contact your bank or payment provider immediately through a trusted number or official app and ask what protective options are available.'
  });
  if (categories.has('remote_access')) actions.push({
    id: 'remote', priority: 'do_now', title: 'End remote access', description: 'Do not install requested software or share your screen. If access was granted, disconnect the device from the internet and seek help from a trusted support channel.'
  });
  actions.push({
    id: 'verify', priority: 'next', title: 'Verify the claim independently', description: 'Open the organization’s official app or type its known website yourself. Do not verify through the message’s link, number, or reply address.'
  });
  actions.push({
    id: 'preserve', priority: 'monitor', title: 'Preserve evidence and report safely', description: 'Keep screenshots and message details. Block or report the sender only after saving information you may need for a bank, platform, or law-enforcement report.'
  });
  return actions;
}

function guidanceFor(entities: ExtractedEntity[], hits: RuleHit[]): VerificationGuidance[] {
  const guidance: VerificationGuidance[] = [{
    title: 'Start from a trusted route',
    detail: 'Open the official app directly or type an independently known official website. Use the contact route shown there.',
    warning: 'Do not use a phone number, reply address, QR code, or link supplied in the suspicious content to verify it.',
  }];
  if (entities.some((entity) => entity.type === 'url' || entity.type === 'domain')) guidance.push({
    title: 'Check the address character by character',
    detail: 'A familiar name in a URL can appear in a subdomain or path. The registered domain, not the visible brand wording, matters.',
  });
  if (hits.some((hit) => hit.category === 'payment_request')) guidance.push({
    title: 'Confirm payment requests out of band',
    detail: 'Find an order, invoice, or support case in the official account before paying. Confirm with a trusted channel you initiated.',
  });
  return guidance;
}

function patternsFor(hits: RuleHit[]): NonNullable<AnalysisResult['patternMatches']> {
  const categories = new Set(hits.map((hit) => hit.category));
  const patterns: NonNullable<AnalysisResult['patternMatches']> = [];
  if (categories.has('credential_request')) patterns.push({ id: 'otp-credential-theft', name: 'Credential or OTP theft', description: 'Requests for codes or passwords intended to take over an account.', confidence: 'medium' });
  if (categories.has('payment_request') && categories.has('urgency')) patterns.push({ id: 'advance-payment', name: 'Urgent payment pressure', description: 'Payment request paired with pressure to act before verification.', confidence: 'medium' });
  if (categories.has('remote_access')) patterns.push({ id: 'remote-access', name: 'Remote access impersonation', description: 'A support-style request to install software or share a screen.', confidence: 'high' });
  return patterns;
}

/**
 * Development-only deterministic fallback. It never fetches supplied URLs,
 * makes no reputation claim, and intentionally marks image OCR as unavailable.
 */
export function createLocalDemoAnalysis(payload: CreateAnalysisPayload): AnalysisResult {
  const source = payload.evidence.map(textForEvidence).join('\n');
  const entities = extractEntities(payload.evidence);
  const hits = ruleHits(source, entities);
  const scored = scoreRisk(hits);
  const findings: AnalysisFinding[] = hits.map((hit) => ({
    id: newClientId('finding'),
    category: hit.category,
    title: hit.title,
    severity: hit.severity,
    confidence: hit.confidence,
    detected: true,
    explanation: hit.explanation,
    evidence: hit.evidence,
    source: hit.category === 'url_risk' ? 'url-analysis' : 'rules',
  }));
  const limitations = [
    'This is a local, rule-based preview. No external reputation, domain-age, trusted-entity, or AI verification was performed.',
    'No scam signal is not proof that a message, sender, website, or payment request is legitimate.',
  ];
  if (payload.evidence.some((item) => item.kind === 'image')) limitations.push('Screenshot OCR and image interpretation require the secure server-side analysis service and were not performed in this preview.');

  return {
    publicId: newClientId('local'),
    title: payload.title || 'Local analysis preview',
    status: 'complete',
    createdAt: new Date().toISOString(),
    localOnly: true,
    evidence: payload.evidence.map(displayEvidence),
    extractedEntities: entities,
    findings,
    riskAssessment: {
      level: scored.level,
      score: scored.score,
      confidence: scored.confidence,
      rationale: hits.length ? hits.map((hit) => hit.title) : ['No deterministic rule was triggered by the submitted text.'],
      limitations,
      engineVersion: 'local-rules-preview/1.0',
    },
    recommendedActions: actionsFor(hits),
    verificationGuidance: guidanceFor(entities, hits),
    patternMatches: patternsFor(hits),
  };
}

const LOCAL_INTERACTION_ACTIONS: Record<IncidentInteraction, Array<{ id: string; priority: RecommendedAction['priority']; title: string; description: string }>> = {
  clicked_link: [
    { id: 'close_suspicious_page', priority: 'immediate', title: 'Close the page without entering anything', description: 'Do not download files, allow notifications, or enter details. Do not return through the supplied link.' },
    { id: 'check_official_account', priority: 'today', title: 'Check the account through its official app or site', description: 'Open the official app directly and review alerts, sessions, and recent activity.' }
  ],
  entered_password: [
    { id: 'change_password_from_trusted_device', priority: 'immediate', title: 'Change the password from a trusted device', description: 'Use the official app or a known address. Do not reuse the password and change it anywhere it was reused.' },
    { id: 'end_account_sessions', priority: 'immediate', title: 'Review sessions and recovery options', description: 'Sign out unknown sessions, review recovery email/phone details, and enable multi-factor authentication where available.' }
  ],
  shared_otp: [
    { id: 'contact_provider_after_otp', priority: 'immediate', title: 'Contact the affected provider independently', description: 'Use the official app or a trusted number to report that a one-time code was shared and ask them to secure the account.' },
    { id: 'check_recent_account_activity', priority: 'immediate', title: 'Review recent activity and payment approvals', description: 'Look for password resets, new devices, unfamiliar transfers, or new payees in the official account.' }
  ],
  installed_app: [
    { id: 'disconnect_device', priority: 'immediate', title: 'Disconnect the device from the internet', description: 'Turn off Wi-Fi/mobile data to end any active remote connection before seeking trusted help.' },
    { id: 'trusted_device_support', priority: 'immediate', title: 'Get trusted device support', description: 'Use a known support provider or someone you trust to remove the app and review the device. Change financial passwords from a different trusted device.' }
  ],
  shared_screen: [
    { id: 'end_screen_sharing', priority: 'immediate', title: 'End screen sharing and remote access', description: 'Close the session, remove remote-control permissions, and disconnect the device if someone may still be connected.' },
    { id: 'secure_visible_accounts', priority: 'immediate', title: 'Secure accounts that were visible', description: 'If you opened banking, email, or payment services while sharing, review sessions and change passwords from a trusted device.' }
  ],
  sent_money: [
    { id: 'contact_payment_provider', priority: 'immediate', title: 'Contact your bank or payment provider immediately', description: 'Use the official app or a trusted number. Tell them a potentially fraudulent transfer was sent and ask what protective or reporting options are available.' },
    { id: 'preserve_transfer_details', priority: 'immediate', title: 'Preserve payment and message evidence', description: 'Keep transfer receipts, transaction IDs, message screenshots, dates, payment destinations, and any platform report references.' }
  ],
  shared_financial_details: [
    { id: 'contact_card_or_bank', priority: 'immediate', title: 'Contact the affected bank or card issuer', description: 'Use a trusted number from a statement or official app. Ask how to protect the card, account, or payment method.' },
    { id: 'watch_transactions', priority: 'today', title: 'Review transactions and alerts', description: 'Check for unfamiliar transactions and enable official transaction alerts where available.' }
  ],
  shared_identity_document: [
    { id: 'secure_identity_accounts', priority: 'today', title: 'Secure accounts linked to the identity document', description: 'Review the official account settings and ask the document issuer or relevant provider what monitoring or replacement options apply.' },
    { id: 'preserve_document_context', priority: 'today', title: 'Preserve exactly what was shared', description: 'Record which document, images, fields, recipient, date, and channel were involved for an official report if needed.' }
  ],
  contacted_sender: [
    { id: 'do_not_continue_contact', priority: 'immediate', title: 'Do not continue the conversation', description: 'Do not negotiate, send more information, or use details provided by the sender to verify their claim.' },
    { id: 'preserve_then_block', priority: 'next', title: 'Preserve evidence, then block or report safely', description: 'Save useful details first. Then use the messaging platform’s reporting process if appropriate.' }
  ]
};

export function createLocalResponsePlan(interactions: IncidentInteraction[]): RecommendedAction[] {
  const actions = interactions.flatMap((interaction) => LOCAL_INTERACTION_ACTIONS[interaction] ?? []);
  const unique = new Map(actions.map((action) => [action.id, action]));
  const order: Record<string, number> = { immediate: 0, do_now: 0, today: 1, next: 2, monitor: 3 };
  return [...unique.values()].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
}
