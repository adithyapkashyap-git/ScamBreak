import type { RequestHandler } from 'express';

import { sendNoContent, sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { clearSessionCookie, setSessionCookie } from '../../lib/session.js';
import { clearCsrfToken, issueCsrfToken } from '../../middleware/csrf.js';
import { toSafeUserDto } from '../../models/User.js';

import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { invalidateUserSessions, loginUser, registerUser } from './auth.service.js';

const validatedBody = <T>(body: unknown): T => body as T;

export const getCsrfToken: RequestHandler = (_req, res): void => {
  const csrfToken = issueCsrfToken(res);
  sendSuccess(res, { csrfToken });
};

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await registerUser(validatedBody<RegisterInput>(req.validated?.body));
  setSessionCookie(res, result.sessionToken);
  sendSuccess(res, { user: result.user }, 201);
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await loginUser(validatedBody<LoginInput>(req.validated?.body));
  setSessionCookie(res, result.sessionToken);
  sendSuccess(res, { user: result.user });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  if (req.auth) {
    await invalidateUserSessions(req.auth.id);
  }
  clearSessionCookie(res);
  clearCsrfToken(res);
  sendNoContent(res);
});

export const getCurrentUser: RequestHandler = (req, res): void => {
  // `requireAuth` loaded the current user from MongoDB, so these values are
  // current rather than only reflecting stale JWT claims.
  sendSuccess(res, {
    user: {
      id: req.auth?.publicId,
      email: req.auth?.email,
      displayName: req.auth?.displayName,
      role: req.auth?.role,
      status: req.auth?.status
    }
  });
};

// Exported for tests and future session-management endpoints.
export const userDtoForSession = toSafeUserDto;
