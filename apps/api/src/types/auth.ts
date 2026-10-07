export const userRoles = ['user', 'moderator', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['active', 'suspended', 'deactivated'] as const;
export type UserStatus = (typeof userStatuses)[number];

export type AuthenticatedUser = Readonly<{
  id: string;
  publicId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  sessionVersion: number;
}>;

export type SessionClaims = Readonly<{
  sub: string;
  publicId: string;
  role: UserRole;
  sessionVersion: number;
}>;
