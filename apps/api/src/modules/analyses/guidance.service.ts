import type { FindingInput, SafeAction, VerificationStep } from "./analysis.types.js";

const actionLibrary: Record<string, SafeAction> = {
  pause_and_verify: { key: "pause_and_verify", priority: "immediate", title: "Pause before acting", description: "Do not respond or make a payment while you independently verify the claim.", when: "Before clicking, replying, or paying", isSafetyCritical: true },
  do_not_click: { key: "do_not_click", priority: "immediate", title: "Do not open the supplied link", description: "Open the organization’s official app or type a trusted address yourself instead.", when: "If a link was supplied", isSafetyCritical: true },
  do_not_share_credentials: { key: "do_not_share_credentials", priority: "immediate", title: "Do not share passwords, PINs, or OTPs", description: "Never give one-time codes, passwords, PINs, CVV/CVC, or recovery codes to a caller or message sender.", when: "If credentials or personal information are requested", isSafetyCritical: true },
  do_not_pay: { key: "do_not_pay", priority: "immediate", title: "Do not send money or an advance fee", description: "Do not transfer funds, pay a fee, or approve a payment request until you have verified it through an independent channel.", when: "If payment is requested", isSafetyCritical: true },
  do_not_install_software: { key: "do_not_install_software", priority: "immediate", title: "Do not install software or share your screen", description: "Do not install remote-access apps or give someone access to your device.", when: "If remote access is requested", isSafetyCritical: true },
  disconnect_if_connected: { key: "disconnect_if_connected", priority: "immediate", title: "Disconnect any remote session", description: "If you already shared your screen or installed remote-access software, disconnect it and seek trusted device support.", when: "If a remote session may have started", isSafetyCritical: true },
  contact_independently: { key: "contact_independently", priority: "today", title: "Contact the organization independently", description: "Use a number or channel from an official app, a statement, or a website you found yourself—not the contact details in the message.", when: "To verify a claimed organization", isSafetyCritical: true },
  open_official_app: { key: "open_official_app", priority: "today", title: "Check through the official app or site", description: "Open the service’s official app directly and look for the claimed alert, order, or account issue there.", when: "For account, delivery, or payment claims" },
  verify_company_independently: { key: "verify_company_independently", priority: "today", title: "Verify the company independently", description: "Find the organization’s official website and job/contact information yourself before continuing.", when: "For job, loan, or business claims" },
  preserve_evidence: { key: "preserve_evidence", priority: "next", title: "Preserve the evidence", description: "Keep screenshots, messages, receipts, account details, and timestamps in case you need to report the incident.", when: "If you may report it or have already interacted" },
  change_password_if_shared: { key: "change_password_if_shared", priority: "immediate", title: "Change exposed passwords", description: "If you entered or shared a password, change it from a trusted device and enable multi-factor authentication where available.", when: "Only if a password or recovery code may have been exposed", isSafetyCritical: true },
  secure_accounts: { key: "secure_accounts", priority: "immediate", title: "Secure affected accounts", description: "Review account sessions and recovery settings using the official app or site from a trusted device.", when: "If a device or account may have been accessed", isSafetyCritical: true },
  use_platform_only: { key: "use_platform_only", priority: "today", title: "Keep payments and messages on the platform", description: "Use the marketplace’s normal in-app payment and support flow; do not move to a private payment channel.", when: "For marketplace interactions" },
  talk_to_someone_trusted: { key: "talk_to_someone_trusted", priority: "today", title: "Ask someone you trust to review it", description: "A second person can help you slow down and spot pressure or inconsistencies.", when: "If the interaction feels urgent or secret" },
};

export function buildSafeActionPlan(findings: FindingInput[]): SafeAction[] {
  const keys = new Set<string>();
  for (const finding of findings) {
    if (finding.state !== "detected") continue;
    finding.recommendedActionKeys.forEach((key) => keys.add(key));
  }
  if (keys.size > 0) keys.add("preserve_evidence");
  return [...keys]
    .map((key) => actionLibrary[key])
    .filter((action): action is SafeAction => Boolean(action))
    .sort((left, right) => ({ immediate: 0, today: 1, next: 2 }[left.priority] - { immediate: 0, today: 1, next: 2 }[right.priority]));
}

export function buildVerificationGuidance(findings: FindingInput[]): VerificationStep[] {
  const hasClaim = findings.some((finding) => finding.state === "detected" && ["impersonation", "account_warning", "url_domain", "url_reputation"].includes(finding.category));
  const hasUrl = findings.some((finding) => finding.state === "detected" && finding.source === "url");
  const steps: VerificationStep[] = [];
  if (hasClaim || hasUrl) {
    steps.push({ key: "official_source", title: "Use an official source you find independently", description: "Search for the organization’s official website yourself, or open its official app. Do not use the supplied link, phone number, or email address as the verification method.", avoidUntrustedContact: true });
  }
  if (hasUrl) {
    steps.push({ key: "official_app_check", title: "Check the claim inside the official app or account", description: "Sign in through your usual official app or a trusted saved address and look for the alert, order, or transaction there.", avoidUntrustedContact: true });
  }
  if (findings.some((finding) => finding.state === "detected" && finding.category === "payment")) {
    steps.push({ key: "payment_independent_confirmation", title: "Confirm the payment request through a separate channel", description: "Call a trusted number from a statement or official app, or confirm with the person through a known, independent channel before paying.", avoidUntrustedContact: true });
  }
  return steps;
}

export { actionLibrary };
