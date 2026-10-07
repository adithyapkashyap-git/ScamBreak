import { Router } from 'express';

import { requireAuth, validate } from '../../middleware/index.js';

import { createAnalysis, deleteAnalysis, getAnalysis, listAnalyses } from './analysis.controller.js';
import {
  analysisParamsSchema,
  createAnalysisSchema,
  deleteAnalysisSchema,
  paginationSchema
} from './analysis.schemas.js';

export const analysisRouter = Router();

analysisRouter.use(requireAuth);
analysisRouter.post('/', validate({ body: createAnalysisSchema }), createAnalysis);
analysisRouter.get('/', validate({ query: paginationSchema }), listAnalyses);
analysisRouter.get('/:analysisId', validate({ params: analysisParamsSchema }), getAnalysis);
analysisRouter.delete(
  '/:analysisId',
  validate({ params: analysisParamsSchema, body: deleteAnalysisSchema }),
  deleteAnalysis
);
