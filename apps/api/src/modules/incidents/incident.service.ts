import { AppError } from '../../lib/AppError.js';
import type { SafeAction } from '../analyses/analysis.types.js';
import { Analysis } from '../analyses/analysis.model.js';

import { Incident } from './incident.model.js';
import type { CreateIncidentInput } from './incident.schemas.js';

type Interaction = CreateIncidentInput['interactions'][number];

const sharedActions: Record<Interaction, SafeAction[]> = {
  clicked_link: [
    { key: 'close_suspicious_page', priority: 'immediate', title: 'Close the page without entering anything', description: 'Do not download files, allow notifications, or enter details. Do not return through the supplied link.', when: 'If you only opened a link', isSafetyCritical: true },
    { key: 'check_official_account', priority: 'today', title: 'Check the account through its official app or site', description: 'Open the official app directly and review alerts, sessions, and recent activity.', when: 'If the link claimed to be from an organization' }
  ],
  entered_password: [
    { key: 'change_password_from_trusted_device', priority: 'immediate', title: 'Change the password from a trusted device', description: 'Use the official app or a known address. Do not reuse the password and change it anywhere it was reused.', when: 'If you entered a password', isSafetyCritical: true },
    { key: 'end_account_sessions', priority: 'immediate', title: 'Review sessions and recovery options', description: 'Sign out unknown sessions, review recovery email/phone details, and enable multi-factor authentication where available.', when: 'After changing the password', isSafetyCritical: true }
  ],
  shared_otp: [
    { key: 'contact_provider_after_otp', priority: 'immediate', title: 'Contact the affected provider independently', description: 'Use the official app or a trusted number to report that a one-time code was shared and ask them to secure the account.', when: 'If you shared an OTP, PIN, recovery, or verification code', isSafetyCritical: true },
    { key: 'check_recent_account_activity', priority: 'immediate', title: 'Review recent activity and payment approvals', description: 'Look for password resets, new devices, unfamiliar transfers, or new payees in the official account.', when: 'Right away', isSafetyCritical: true }
  ],
  installed_app: [
    { key: 'disconnect_device', priority: 'immediate', title: 'Disconnect the device from the internet', description: 'Turn off Wi-Fi/mobile data to end any active remote connection before seeking trusted help.', when: 'If remote-access software was installed', isSafetyCritical: true },
    { key: 'trusted_device_support', priority: 'immediate', title: 'Get trusted device support', description: 'Use a known support provider or someone you trust to remove the app and review the device. Change financial passwords from a different trusted device.', when: 'Before using banking or payment apps again', isSafetyCritical: true }
  ],
  shared_screen: [
    { key: 'end_screen_sharing', priority: 'immediate', title: 'End screen sharing and remote access', description: 'Close the session, remove remote-control permissions, and disconnect the device if someone may still be connected.', when: 'Immediately', isSafetyCritical: true },
    { key: 'secure_visible_accounts', priority: 'immediate', title: 'Secure accounts that were visible', description: 'If you opened banking, email, or payment services while sharing, review sessions and change passwords from a trusted device.', when: 'If account information may have been seen', isSafetyCritical: true }
  ],
  sent_money: [
    { key: 'contact_payment_provider', priority: 'immediate', title: 'Contact your bank or payment provider immediately', description: 'Use the official app or a trusted number. Tell them a potentially fraudulent transfer was sent and ask what protective or reporting options are available.', when: 'As soon as possible', isSafetyCritical: true },
    { key: 'preserve_transfer_details', priority: 'immediate', title: 'Preserve payment and message evidence', description: 'Keep transfer receipts, transaction IDs, message screenshots, dates, payment destinations, and any platform report references.', when: 'Before blocking or deleting the conversation', isSafetyCritical: true }
  ],
  shared_financial_details: [
    { key: 'contact_card_or_bank', priority: 'immediate', title: 'Contact the affected bank or card issuer', description: 'Use a trusted number from a statement or official app. Ask how to protect the card, account, or payment method.', when: 'If card or bank information was shared', isSafetyCritical: true },
    { key: 'watch_transactions', priority: 'today', title: 'Review transactions and alerts', description: 'Check for unfamiliar transactions and enable official transaction alerts where available.', when: 'Over the next several days' }
  ],
  shared_identity_document: [
    { key: 'secure_identity_accounts', priority: 'today', title: 'Secure accounts linked to the identity document', description: 'Review the official account settings and ask the document issuer or relevant provider what monitoring or replacement options apply.', when: 'If an identity document was sent', isSafetyCritical: true },
    { key: 'preserve_document_context', priority: 'today', title: 'Preserve exactly what was shared', description: 'Record which document, images, fields, recipient, date, and channel were involved for an official report if needed.', when: 'Before deleting the conversation' }
  ],
  contacted_sender: [
    { key: 'do_not_continue_contact', priority: 'immediate', title: 'Do not continue the conversation', description: 'Do not negotiate, send more information, or use details provided by the sender to verify their claim.', when: 'After you recognize the interaction may be risky', isSafetyCritical: true },
    { key: 'preserve_then_block', priority: 'next', title: 'Preserve evidence, then block or report safely', description: 'Save useful details first. Then use the messaging platform’s reporting process if appropriate.', when: 'After preserving evidence' }
  ]
};

function buildResponsePlan(interactions: Interaction[]): SafeAction[] {
  const actions = interactions.flatMap((interaction) => sharedActions[interaction]);
  const unique = new Map(actions.map((action) => [action.key, action]));
  return [...unique.values()].sort(
    (left, right) => ({ immediate: 0, today: 1, next: 2 }[left.priority] - { immediate: 0, today: 1, next: 2 }[right.priority])
  );
}

export async function createIncident(ownerUserId: string, input: CreateIncidentInput): Promise<{
  id: string;
  interactions: Interaction[];
  responsePlan: SafeAction[];
  createdAt: string;
}> {
  let analysisId: unknown;
  if (input.analysisId && !input.analysisId.startsWith('local-')) {
    const analysis = await Analysis.findOne({ ownerUserId, publicId: input.analysisId, status: { $ne: 'deleted' } }).exec();
    if (analysis) {
      analysisId = analysis._id;
    }
  }
  const responsePlan = buildResponsePlan(input.interactions);
  const incident = await Incident.create({
    ownerUserId,
    ...(analysisId ? { analysisId } : {}),
    interactions: input.interactions,
    ...(input.notes ? { notes: input.notes } : {}),
    responsePlan
  });
  return {
    id: incident.publicId,
    interactions: input.interactions,
    responsePlan,
    createdAt: incident.createdAt.toISOString()
  };
}

export async function listIncidents(ownerUserId: string): Promise<Array<{
  id: string;
  interactions: string[];
  status: string;
  createdAt: string;
}>> {
  const incidents = await Incident.find({ ownerUserId }).sort({ createdAt: -1 }).limit(100).exec();
  return incidents.map((incident) => ({
    id: incident.publicId,
    interactions: incident.interactions,
    status: incident.status,
    createdAt: incident.createdAt.toISOString()
  }));
}
