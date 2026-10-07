import { z } from 'zod';

import { publicIdSchema } from '../analyses/analysis.schemas.js';

export const incidentInteractions = [
  'clicked_link',
  'entered_password',
  'shared_otp',
  'installed_app',
  'shared_screen',
  'sent_money',
  'shared_financial_details',
  'shared_identity_document',
  'contacted_sender'
] as const;

export const createIncidentSchema = z
  .object({
    analysisId: z.string().trim().max(100).optional().transform((val) => (val && val.length > 0 ? val : undefined)),
    interactions: z.array(z.enum(incidentInteractions)).min(1).max(9).transform((values) => [...new Set(values)]),
    notes: z.string().trim().max(2_000).optional().transform((val) => (val && val.length > 0 ? val : undefined))
  })
  .strict();

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
