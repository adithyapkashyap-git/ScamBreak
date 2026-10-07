import { z } from 'zod';

import { publicIdSchema } from '../analyses/analysis.schemas.js';

export const entityVerifyQuerySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    domain: z.string().trim().toLowerCase().max(255).optional()
  })
  .strict();

export const entityListQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

export const entityParamsSchema = z.object({ entityId: publicIdSchema }).strict();
