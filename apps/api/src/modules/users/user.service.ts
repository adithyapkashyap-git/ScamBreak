import { AppError } from '../../lib/AppError.js';
import { signSession } from '../../lib/session.js';
import {
  User,
  hashPassword,
  toAuthenticatedUser,
  toSafeUserDto,
  verifyPassword,
  type SafeUserDto
} from '../../models/User.js';

import type { DeleteAccountInput, UpdateCurrentUserInput, UpdatePasswordInput } from './user.schemas.js';

export const getCurrentUser = async (userId: string): Promise<SafeUserDto> => {
  const user = await User.findById(userId).exec();
  if (!user || user.status !== 'active') {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested account could not be found.');
  }
  return toSafeUserDto(user);
};

export const updateCurrentUser = async (
  userId: string,
  input: UpdateCurrentUserInput
): Promise<SafeUserDto> => {
  const user = await User.findById(userId).exec();
  if (!user || user.status !== 'active') {
    throw new AppError(404, 'USER_NOT_FOUND', 'The requested account could not be found.');
  }

  if (input.displayName !== undefined) {
    user.displayName = input.displayName;
  }
  if (input.privacy?.analysisRetentionDays !== undefined) {
    user.privacy.analysisRetentionDays = input.privacy.analysisRetentionDays;
  }
  if (input.privacy?.allowCommunityReportPrompts !== undefined) {
    user.privacy.allowCommunityReportPrompts = input.privacy.allowCommunityReportPrompts;
  }

  await user.save();
  return toSafeUserDto(user);
};

export const changePassword = async (
  userId: string,
  input: UpdatePasswordInput
): Promise<{ user: SafeUserDto; sessionToken: string }> => {
  const user = await User.findById(userId).select('+passwordHash').exec();
  if (!user || user.status !== 'active' || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.passwordChangedAt = new Date();
  user.sessionVersion += 1;
  await user.save();

  const authenticated = toAuthenticatedUser(user);
  return {
    user: toSafeUserDto(user),
    sessionToken: signSession({
      sub: authenticated.id,
      publicId: authenticated.publicId,
      role: authenticated.role,
      sessionVersion: authenticated.sessionVersion
    })
  };
};

/**
 * Soft-deactivation preserves a short, policy-controlled window for data
 * deletion jobs while immediately revoking sessions and preventing login.
 */
export const deactivateCurrentUser = async (userId: string, input: DeleteAccountInput): Promise<void> => {
  const user = await User.findById(userId).select('+passwordHash').exec();
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
  }

  user.status = 'deactivated';
  user.deletedAt = new Date();
  user.sessionVersion += 1;
  await user.save();
};
