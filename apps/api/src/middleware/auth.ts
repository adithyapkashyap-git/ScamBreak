import type { Request, RequestHandler, Response } from 'express';

import { config } from '../config/index.js';
import { AppError } from '../lib/AppError.js';
import { clearSessionCookie, verifySession } from '../lib/session.js';
import { User, toAuthenticatedUser } from '../models/User.js';
import { userRoles, type AuthenticatedUser, type UserRole } from '../types/auth.js';

const bearerToken = (request: Request): string | undefined => {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token || undefined;
};

const sessionToken = (request: Request): string | undefined =>
  (request.cookies?.[config.auth.sessionCookieName] as string | undefined) ?? bearerToken(request);

const loadAuthenticatedUser = async (request: Request): Promise<AuthenticatedUser | undefined> => {
  const token = sessionToken(request);
  if (!token) {
    return undefined;
  }

  let claims;
  try {
    claims = verifySession(token);
  } catch {
    throw new AppError(401, 'AUTH_SESSION_INVALID', 'Your session is invalid or has expired.');
  }

  if (!userRoles.includes(claims.role)) {
    throw new AppError(401, 'AUTH_SESSION_INVALID', 'Your session is invalid or has expired.');
  }

  const user = await User.findById(claims.sub).exec();
  if (
    !user ||
    user.status !== 'active' ||
    user.publicId !== claims.publicId ||
    user.sessionVersion !== claims.sessionVersion
  ) {
    throw new AppError(401, 'AUTH_SESSION_INVALID', 'Your session is invalid or has expired.');
  }

  return toAuthenticatedUser(user);
};

const rejectUnauthenticated = (response: Response): never => {
  clearSessionCookie(response);
  throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required for this resource.');
};

export const requireAuth: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const user = await loadAuthenticatedUser(req);
    if (!user) {
      rejectUnauthenticated(res);
    }

    req.auth = user;
    next();
  } catch (error) {
    if (error instanceof AppError && error.code === 'AUTH_SESSION_INVALID') {
      clearSessionCookie(res);
    }
    next(error);
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const user = await loadAuthenticatedUser(req);
    if (user) {
      req.auth = user;
    }
    next();
  } catch {
    // Public endpoints intentionally do not reveal whether an invalid cookie exists.
    next();
  }
};

export const requireRole = (...allowedRoles: UserRole[]): RequestHandler => (req, _res, next): void => {
  if (!req.auth) {
    next(new AppError(401, 'AUTH_REQUIRED', 'Authentication is required for this resource.'));
    return;
  }

  if (!allowedRoles.includes(req.auth.role)) {
    next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    return;
  }

  next();
};
