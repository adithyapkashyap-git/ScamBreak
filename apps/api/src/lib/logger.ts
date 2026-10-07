import pino from 'pino';

import { config } from '../config/index.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  base: {
    service: 'scambreak-api',
    environment: config.nodeEnv
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.otp',
      'req.body.pin',
      'req.body.token',
      'req.body.accessToken',
      'req.body.refreshToken',
      'res.headers.set-cookie'
    ],
    censor: '[REDACTED]'
  }
});

/**
 * Error objects can carry third-party response bodies, database values, or
 * filesystem paths. Log a stable diagnostic category instead of serializing
 * arbitrary error data alongside potentially sensitive evidence workflows.
 */
export const safeErrorMetadata = (error: unknown): { errorType: string; errorCode?: string } => {
  if (typeof error !== 'object' || error === null) return { errorType: typeof error };
  const candidate = error as { name?: unknown; code?: unknown };
  const errorType = typeof candidate.name === 'string' && candidate.name.length <= 80
    ? candidate.name
    : 'UnknownError';
  const errorCode = typeof candidate.code === 'string' && /^[A-Z0-9_]{2,80}$/.test(candidate.code)
    ? candidate.code
    : undefined;
  return { errorType, ...(errorCode ? { errorCode } : {}) };
};
