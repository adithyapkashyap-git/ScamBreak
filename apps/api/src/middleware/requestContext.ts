import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

import { logger } from '../lib/logger.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const getRequestId = (candidate: string | undefined): string =>
  candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();

/**
 * Records only operational metadata. Evidence bodies, query strings, cookies,
 * authorization headers, and remote URLs are intentionally not logged.
 */
export const requestContext: RequestHandler = (req, res, next): void => {
  const header = req.header('x-request-id');
  const requestId = getRequestId(header);
  const startedAt = performance.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logger.info(
      {
        requestId,
        operation: 'http.request',
        method: req.method,
        route: req.route?.path ?? req.path,
        statusCode: res.statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100
      },
      'Request completed'
    );
  });

  next();
};
