import type { RequestHandler } from 'express';

import { sendNoContent, sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { recordAuditEvent } from '../audit/audit.service.js';
import { clearSessionCookie, setSessionCookie } from '../../lib/session.js';
import { clearCsrfToken } from '../../middleware/csrf.js';

import type { DeleteAccountInput, UpdateCurrentUserInput, UpdatePasswordInput } from './user.schemas.js';
import { changePassword, deactivateCurrentUser, getCurrentUser, updateCurrentUser } from './user.service.js';

const validatedBody = <T>(body: unknown): T => body as T;

export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.auth!.id);
  sendSuccess(res, { user });
});

export const patchMe: RequestHandler = asyncHandler(async (req, res) => {
  const body = validatedBody<UpdateCurrentUserInput>(req.validated?.body);
  const user = await updateCurrentUser(
    req.auth!.id,
    body
  );
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'account.settings.update',
    resourceType: 'user',
    resourcePublicId: req.auth!.publicId,
    outcome: 'success',
    requestId: req.requestId,
    metadata: {
      displayNameChanged: body.displayName !== undefined,
      retentionChanged: body.privacy?.analysisRetentionDays !== undefined,
      communityPromptChanged: body.privacy?.allowCommunityReportPrompts !== undefined
    }
  });
  sendSuccess(res, { user });
});

export const patchMyPassword: RequestHandler = asyncHandler(async (req, res) => {
  const result = await changePassword(
    req.auth!.id,
    validatedBody<UpdatePasswordInput>(req.validated?.body)
  );
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'account.password.change',
    resourceType: 'user',
    resourcePublicId: req.auth!.publicId,
    outcome: 'success',
    requestId: req.requestId
  });
  setSessionCookie(res, result.sessionToken);
  sendSuccess(res, { user: result.user });
});

export const deleteMe: RequestHandler = asyncHandler(async (req, res) => {
  await deactivateCurrentUser(req.auth!.id, validatedBody<DeleteAccountInput>(req.validated?.body));
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'account.deactivate',
    resourceType: 'user',
    resourcePublicId: req.auth!.publicId,
    outcome: 'success',
    requestId: req.requestId
  });
  clearSessionCookie(res);
  clearCsrfToken(res);
  sendNoContent(res);
});
