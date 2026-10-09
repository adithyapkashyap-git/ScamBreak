import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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

export const verifySignedCsrfToken = (token: string): boolean => {
  if (typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const [nonce, timestampStr, receivedSignature] = parts;
  if (!nonce || !timestampStr || !receivedSignature) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 36);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const now = Date.now();
  // Valid for 24 hours, with 5 minutes clock-skew tolerance in the future
  if (timestamp > now + 300_000 || now - timestamp > 24 * 60 * 60 * 1000) {
    return false;
  }

  const payload = `${nonce}.${timestampStr}`;
  const expectedSignature = createHmac('sha256', config.auth.cookieSigningSecret)
    .update(payload)
    .digest('base64url');

  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

/** A browser client obtains this token from the response body, then sends it in X-CSRF-Token. */
export const issueCsrfToken = (response: Response): string => {
  const nonce = randomBytes(24).toString('base64url');
  const timestamp = Date.now().toString(36);
  const payload = `${nonce}.${timestamp}`;
  const signature = createHmac('sha256', config.auth.cookieSigningSecret)
    .update(payload)
    .digest('base64url');
  const token = `${payload}.${signature}`;

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

  // Non-browser API clients or clients authenticated by a bearer token do not send
  // ambient cookies that CSRF attacks rely on.
  if (req.header('authorization')?.startsWith('Bearer ')) {
    next();
    return;
  }

  const received = req.header('x-csrf-token');
  if (!received) {
    next(new AppError(403, 'CSRF_TOKEN_INVALID', 'A valid CSRF token is required for this request.'));
    return;
  }

  const expected = req.signedCookies?.[config.auth.csrfCookieName] as string | undefined;

  // 1. If the browser provided a signed cookie (e.g. desktop browsers, same-site context), verify it matches
  if (expected && tokensMatch(received, expected)) {
    next();
    return;
  }

  // 2. If the browser dropped the cross-site/third-party cookie (e.g. Safari iOS ITP, mobile browsers),
  // verify the cryptographic HMAC signature embedded in the token issued by this server
  if (verifySignedCsrfToken(received)) {
    next();
    return;
  }

  next(new AppError(403, 'CSRF_TOKEN_INVALID', 'A valid CSRF token is required for this request.'));
};
