import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { model, Schema, type HydratedDocument, type Model } from 'mongoose';

import {
  userRoles,
  userStatuses,
  type AuthenticatedUser,
  type UserRole,
  type UserStatus
} from '../types/auth.js';

const PASSWORD_SALT_ROUNDS = 12;

export interface UserPrivacySettings {
  analysisRetentionDays: number;
  allowCommunityReportPrompts: boolean;
}

export interface UserAttributes {
  publicId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  sessionVersion: number;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  deletedAt?: Date;
  privacy: UserPrivacySettings;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const privacySchema = new Schema<UserPrivacySettings>(
  {
    analysisRetentionDays: { type: Number, default: 90, min: 1, max: 3650 },
    allowCommunityReportPrompts: { type: Boolean, default: true }
  },
  { _id: false }
);

const userSchema = new Schema<UserAttributes>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => `usr_${nanoid(18)}`
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: userRoles,
      default: 'user',
      index: true
    },
    status: {
      type: String,
      enum: userStatuses,
      default: 'active',
      index: true
    },
    sessionVersion: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date },
    privacy: { type: privacySchema, default: () => ({}) }
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_document, returned: Record<string, unknown>) => {
        delete returned.passwordHash;
        delete returned._id;
        return returned;
      }
    }
  }
);

userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

export const User: Model<UserAttributes> = model<UserAttributes>('User', userSchema);

export const hashPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);

export type SafeUserDto = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  privacy: UserPrivacySettings;
  createdAt: string;
  updatedAt: string;
}>;

/**
 * Explicit DTO allowlist. Do not replace with `res.json(user)` because account
 * records may gain sensitive fields over time.
 */
export const toSafeUserDto = (user: UserAttributes | UserDocument): SafeUserDto => ({
  id: user.publicId,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  status: user.status,
  privacy: {
    analysisRetentionDays: user.privacy.analysisRetentionDays,
    allowCommunityReportPrompts: user.privacy.allowCommunityReportPrompts
  },
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

export const toAuthenticatedUser = (user: UserAttributes | UserDocument): AuthenticatedUser => ({
  id: (user as UserDocument)._id.toString(),
  publicId: user.publicId,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  status: user.status,
  sessionVersion: user.sessionVersion
});
