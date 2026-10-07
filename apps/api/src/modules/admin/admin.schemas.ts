import { z } from 'zod';

export const adminListQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
