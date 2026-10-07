import type { FindingInput } from "../analyses/analysis.types.js";
import { safeExcerpt } from "../analyses/dataSanitization.js";

export type TextSignalInput = {
  evidencePublicId: string;
  text: string;
  hasUrl: boolean;
  hasPaymentHandle: boolean;
};

type SignalRule = {
  code: string;
  category: string;
  severity: FindingInput["severity"];
  confidence: FindingInput["confidence"];
  title: string;
  explanation: string;
  patterns: RegExp[];
  actionKeys: string[];
  required?: (input: TextSignalInput) => boolean;
};

const rules: SignalRule[] = [
  {
    code: "urgency_pressure",
    category: "pressure",
    severity: "medium",
    confidence: "moderate",
    title: "The message uses urgency or pressure",
    explanation: "The sender pushes for a quick decision. Pressure can prevent independent verification.",
    patterns: [/\b(?:urgent(?:ly)?|immediately|act now|limited time|final (?:notice|warning)|within \d+|today only|expires? (?:today|soon)|do not delay)\b/i],
    actionKeys: ["pause_and_verify"],
  },
  {
    code: "fear_or_threat_language",
    category: "pressure",
    severity: "high",
    confidence: "moderate",
    title: "The message threatens a negative consequence",
    explanation: "Threats about account closure, legal action, or loss of service are commonly used to rush people into acting.",
    patterns: [/\b(?:account (?:will be |has been )?(?:blocked|suspended|closed)|legal action|arrest|penalty|fine|lose (?:access|your account)|service (?:will be )?terminated)\b/i],
    actionKeys: ["pause_and_verify", "do_not_click"],
  },
  {
    code: "credential_or_otp_request",
    category: "credential_theft",
    severity: "critical",
    confidence: "strong",
    title: "The message asks for a password, PIN, or OTP",
    explanation: "Legitimate organizations should not ask you to share a password, PIN, or one-time code through a message or call.",
    patterns: [/\b(?:share|send|reply(?: with)?|provide|tell(?: us)?|enter)\s+(?:your\s+)?(?:otp|one[- ]time (?:password|code)|password|passcode|pin|cvv|cvc)\b/i],
    actionKeys: ["do_not_share_credentials", "contact_independently"],
  },
  {
    code: "sensitive_data_request",
    category: "data_theft",
    severity: "high",
    confidence: "moderate",
    title: "The message requests sensitive personal or financial information",
    explanation: "Requests for card, bank, identity, or account details should be verified through an official channel you find independently.",
    patterns: [/\b(?:share|send|provide|upload|verify)\s+(?:your\s+)?(?:card details|bank details|account number|aadhaar|pan(?: card)?|ssn|identity (?:document|proof)|date of birth)\b/i],
    actionKeys: ["do_not_share_credentials", "contact_independently"],
  },
  {
    code: "unusual_payment_request",
    category: "payment",
    severity: "high",
    confidence: "moderate",
    title: "The message asks for a payment in a potentially unusual way",
    explanation: "Payment requests sent through a message, especially with a handle, transfer instruction, or urgency, need independent verification.",
    patterns: [/\b(?:pay(?:ment)?|transfer|deposit|fee|advance|processing charge|refundable (?:fee|deposit)|send money|upi|gift card|crypto(?:currency)?)\b/i],
    actionKeys: ["do_not_pay", "contact_independently"],
    required: (input) => input.hasPaymentHandle || /\b(?:pay|transfer|send money|deposit|fee|upi|crypto|gift card)\b/i.test(input.text),
  },
  {
    code: "remote_access_request",
    category: "remote_access",
    severity: "critical",
    confidence: "strong",
    title: "The sender asks you to install software or grant screen access",
    explanation: "Remote-access requests can let someone control your device or observe financial activity.",
    patterns: [/\b(?:install|download)\s+(?:the\s+)?(?:app|software)|\b(?:share (?:your )?screen|screen[- ]share|remote (?:access|support)|anydesk|teamviewer|quick support)\b/i],
    actionKeys: ["do_not_install_software", "disconnect_if_connected"],
  },
  {
    code: "secrecy_instruction",
    category: "social_engineering",
    severity: "medium",
    confidence: "moderate",
    title: "The sender tells you to keep the interaction secret",
    explanation: "Requests to avoid telling a bank, colleague, or family member can be a social-engineering tactic.",
    patterns: [/\b(?:do not tell|keep (?:this )?secret|confidential|don't (?:inform|share with)|avoid (?:contacting|telling))\b/i],
    actionKeys: ["pause_and_verify"],
  },
  {
    code: "authority_impersonation_language",
    category: "impersonation",
    severity: "high",
    confidence: "limited",
    title: "The message claims authority or official status",
    explanation: "A claim to be from a bank, government body, police, or support team is not proof of identity. Verify independently.",
    patterns: [/\b(?:bank|reserve bank|government|police|income tax|tax department|court|customer support|security team|kyc department)\b/i],
    actionKeys: ["contact_independently"],
  },
  {
    code: "account_security_warning",
    category: "account_warning",
    severity: "medium",
    confidence: "moderate",
    title: "The message uses an account or security warning",
    explanation: "Account-warning messages can be genuine, but links and contact details in the message should not be trusted without verification.",
    patterns: [/\b(?:unusual (?:activity|login)|security alert|verify (?:your )?account|kyc (?:update|pending|expired)|account (?:verification|warning)|password (?:reset|expired))\b/i],
    actionKeys: ["open_official_app"],
  },
  {
    code: "reward_or_prize_bait",
    category: "reward_bait",
    severity: "medium",
    confidence: "moderate",
    title: "The message offers a prize, reward, or unexpected benefit",
    explanation: "Unexpected rewards can be used to lure people into sharing information or paying a fee.",
    patterns: [/\b(?:you(?:'ve| have) won|winner|prize|reward|cashback|gift|lucky draw|claim your)\b/i],
    actionKeys: ["pause_and_verify", "do_not_pay"],
  },
  {
    code: "investment_return_claim",
    category: "investment",
    severity: "high",
    confidence: "moderate",
    title: "The message promises unusually certain investment returns",
    explanation: "Guaranteed or unusually high returns are a common investment-scam signal. Do not transfer money based on this claim.",
    patterns: [/\b(?:guaranteed (?:return|profit)|risk[- ]free (?:return|profit)|double your money|daily returns?|assured returns?|100% (?:profit|return))\b/i],
    actionKeys: ["do_not_pay", "pause_and_verify"],
  },
  {
    code: "job_payment_pattern",
    category: "job_recruitment",
    severity: "high",
    confidence: "moderate",
    title: "The message combines a job opportunity with a payment request",
    explanation: "Legitimate employers do not normally require an advance fee, training payment, or equipment deposit to hire you.",
    patterns: [/\b(?:job|hiring|recruit(?:ment|er)|work from home|salary|interview).{0,100}\b(?:fee|deposit|registration|training|payment)\b/i],
    actionKeys: ["do_not_pay", "verify_company_independently"],
  },
  {
    code: "delivery_or_refund_pattern",
    category: "delivery_refund",
    severity: "medium",
    confidence: "moderate",
    title: "The message uses a delivery, refund, or parcel theme",
    explanation: "Delivery and refund themes are often used with links or fee requests. Check the order in the official app or website directly.",
    patterns: [/\b(?:parcel|delivery|courier|shipment|refund|chargeback|customs|tracking)\b/i],
    actionKeys: ["open_official_app", "do_not_click"],
  },
  {
    code: "verification_bypass_request",
    category: "social_engineering",
    severity: "high",
    confidence: "moderate",
    title: "The sender tries to bypass normal verification",
    explanation: "Being asked not to use an official app, website, or support channel is a warning sign.",
    patterns: [/\b(?:do not (?:use|open|contact) (?:the )?(?:official|bank|app|website)|use this link only|verification (?:is )?not required|skip (?:the )?verification)\b/i],
    actionKeys: ["contact_independently", "open_official_app"],
  },
];

function createFinding(rule: SignalRule, input: TextSignalInput, match?: RegExpMatchArray | null): FindingInput {
  const excerpt = match ? safeExcerpt(input.text, match.index, (match.index ?? 0) + match[0].length) : "No matching phrase was detected in the submitted text.";
  return {
    code: rule.code,
    category: rule.category,
    state: match ? "detected" : "not_detected",
    severity: rule.severity,
    confidence: match ? rule.confidence : "limited",
    title: rule.title,
    explanation: rule.explanation,
    evidence: match ? [{ evidencePublicId: input.evidencePublicId, excerpt }] : [],
    recommendedActionKeys: rule.actionKeys,
    source: "rule",
  };
}

/**
 * Runs independent, explainable text rules. Negative results are preserved so
 * the caller can distinguish "not found" from an unexecuted rule.
 */
export function evaluateTextSignals(input: TextSignalInput): FindingInput[] {
  return rules.map((rule) => {
    if (rule.required && !rule.required(input)) return createFinding(rule, input);
    const match = rule.patterns.map((pattern) => input.text.match(pattern)).find(Boolean) ?? null;
    return createFinding(rule, input, match);
  });
}

export const textSignalCodes = rules.map((rule) => rule.code);
