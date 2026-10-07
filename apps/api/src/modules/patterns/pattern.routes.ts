import { Router } from 'express';

import { requireAuth, requireRole, validate } from '../../middleware/index.js';

import { listAdminPatterns, listPublicPatterns, upsertPattern } from './pattern.controller.js';
import { patternInputSchema, patternListQuerySchema } from './pattern.schemas.js';

export const patternRouter = Router();
patternRouter.use(requireAuth);
patternRouter.get('/', validate({ query: patternListQuerySchema }), listPublicPatterns);

export const adminPatternRouter = Router();
adminPatternRouter.use(requireAuth, requireRole('admin'));
adminPatternRouter.get('/', listAdminPatterns);
adminPatternRouter.put('/', validate({ body: patternInputSchema }), upsertPattern);
