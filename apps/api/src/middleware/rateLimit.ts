import { rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';

import { config } from '../config/index.js';

const rateLimitResponse = (request: Request, response: Response) => {
  response.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait before trying again.',
      requestId: request.requestId
    }
  });
};

const sharedOptions = {
  windowMs: config.rateLimit.windowMs,
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler: rateLimitResponse,
  skip: (request: Request) => request.path === '/healthz' || request.path === '/readyz'
};

export const apiRateLimiter = rateLimit({
  ...sharedOptions,
  limit: config.rateLimit.max
});

export const authRateLimiter = rateLimit({
  ...sharedOptions,
  limit: config.rateLimit.authMax,
  // Login attempts need a tighter IP budget; account existence is never exposed.
  skip: (request: Request) => request.method === 'OPTIONS'
});
