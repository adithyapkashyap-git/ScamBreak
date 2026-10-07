import { AppError } from '../../lib/AppError.js';
import { signSession } from '../../lib/session.js';
import { config } from '../../config/index.js';
import {
  User,
  hashPassword,
  toAuthenticatedUser,
  toSafeUserDto,
  verifyPassword,
  type SafeUserDto,
  type UserDocument
} from '../../models/User.js';

import type { LoginInput, RegisterInput } from './auth.schemas.js';

export type AuthResult = Readonly<{
  user: SafeUserDto;
  sessionToken: string;
}>;

const createAuthResult = (user: UserDocument): AuthResult => {
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

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await User.exists({ email: input.email });
  if (existing) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    role: 'user',
    status: 'active',
    privacy: {
      analysisRetentionDays: config.privacy.analysisRetentionDays,
      allowCommunityReportPrompts: true
    }
  });

  return createAuthResult(user);
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email }).select('+passwordHash').exec();

  // Deliberately use one response for unknown emails, wrong passwords, suspended
  // accounts, and deactivated accounts to reduce account enumeration.
  if (!user || user.status !== 'active' || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return createAuthResult(user);
};

export const invalidateUserSessions = async (userId: string): Promise<void> => {
  await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } }).exec();
};
