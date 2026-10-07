import { randomBytes } from "node:crypto";

/**
 * A compact, opaque identifier for API routes. This deliberately avoids
 * Mongo ObjectIds, which leak creation time and are not a public contract.
 */
export function createPublicId(prefix: string): string {
  const token = randomBytes(18).toString("base64url");
  return `${prefix}_${token}`;
}
