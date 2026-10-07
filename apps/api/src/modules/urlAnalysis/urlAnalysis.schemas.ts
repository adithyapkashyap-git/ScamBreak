import { z } from 'zod';

export const inspectUrlSchema = z
  .object({ url: z.string().trim().min(1).max(4_096) })
  .strict();

export type InspectUrlInput = z.infer<typeof inspectUrlSchema>;
