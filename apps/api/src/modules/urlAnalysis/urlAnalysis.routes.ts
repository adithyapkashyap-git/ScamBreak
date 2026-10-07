import { Router } from 'express';

import { requireAuth, validate } from '../../middleware/index.js';

import { inspectUrl } from './urlAnalysis.controller.js';
import { inspectUrlSchema } from './urlAnalysis.schemas.js';

export const urlAnalysisRouter = Router();
urlAnalysisRouter.post('/', requireAuth, validate({ body: inspectUrlSchema }), inspectUrl);
