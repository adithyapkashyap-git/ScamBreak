import type { AuthenticatedUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthenticatedUser;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
