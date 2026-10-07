import { logger, safeErrorMetadata } from '../../lib/logger.js';

import { AuditLog } from './auditLog.model.js';

export async function recordAuditEvent(input: {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourcePublicId?: string;
  outcome: 'success' | 'rejected' | 'failed';
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    await AuditLog.create(input);
  } catch (error) {
    // Audit persistence should be monitored, but must not leak a database
    // failure into a user response or log sensitive request bodies.
    logger.error(
      { operation: 'audit.write', action: input.action, ...safeErrorMetadata(error) },
      'Audit event could not be persisted'
    );
  }
}
