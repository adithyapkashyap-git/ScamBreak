import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { CookieOptions, RequestHandler, Response } from 'express';

import { config } from '../config/index.js';
import { AppError } from '../lib/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: config.auth.secureCookies,
  sameSite: config.auth.cookieSameSite,
  path: '/'
};

const tokensMatch = (received: string, expected: string): boolean => {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

/** A browser client obtains this token from the response body, then sends it in X-CSRF-Token. */
export const issueCsrfToken = (response: Response): string => {
  const token = randomBytes(32).toString('base64url');
  response.cookie(config.auth.csrfCookieName, token, {
    ...csrfCookieOptions,
    signed: true
  });
  return token;
};

export const clearCsrfToken = (response: Response): void => {
  response.clearCookie(config.auth.csrfCookieName, csrfCookieOptions);
};

export const csrfProtection: RequestHandler = (req, _res, next): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Non-browser API clients authenticated by a bearer token do not send the
  // ambient cookie that CSRF attacks rely on. Cookie-authenticated requests
  // remain protected by the signed double-submit token below.
  if (req.header('authorization')?.startsWith('Bearer ')) {
    next();
    return;
  }

  const received = req.header('x-csrf-token');
  const expected = req.signedCookies?.[config.auth.csrfCookieName] as string | undefined;

  if (!received || !expected || !tokensMatch(received, expected)) {
    next(new AppError(403, 'CSRF_TOKEN_INVALID', 'A valid CSRF token is required for this request.'));
    return;
  }

  next();
};
