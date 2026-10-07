import type { CookieOptions, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { config } from '../config/index.js';
import type { SessionClaims } from '../types/auth.js';

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.auth.secureCookies,
  sameSite: config.auth.cookieSameSite,
  path: '/'
};

export const signSession = (claims: SessionClaims): string =>
  jwt.sign(claims, config.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: 'scambreak-api',
    audience: 'scambreak-client'
  });

export const setSessionCookie = (response: Response, token: string): void => {
  response.cookie(config.auth.sessionCookieName, token, sessionCookieOptions);
};

export const clearSessionCookie = (response: Response): void => {
  response.clearCookie(config.auth.sessionCookieName, sessionCookieOptions);
};

export const verifySession = (token: string): SessionClaims => {
  const decoded = jwt.verify(token, config.auth.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'scambreak-api',
    audience: 'scambreak-client'
  });

  if (
    typeof decoded !== 'object' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.publicId !== 'string' ||
    typeof decoded.role !== 'string' ||
    typeof decoded.sessionVersion !== 'number'
  ) {
    throw new Error('Invalid session claims.');
  }

  return {
    sub: decoded.sub,
    publicId: decoded.publicId,
    role: decoded.role as SessionClaims['role'],
    sessionVersion: decoded.sessionVersion
  };
};
