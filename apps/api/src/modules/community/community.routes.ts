import { Router } from 'express';

import { requireAuth, requireRole, validate } from '../../middleware/index.js';

import {
  createAbuseReportController,
  createCommunityReportController,
  listMyCommunityReportsController,
  listPendingCommunityReportsController,
  listPublishedCommunityReportsController,
  moderateCommunityReportController
} from './community.controller.js';
import {
  communityPaginationSchema,
  createAbuseReportSchema,
  createCommunityReportSchema,
  moderationDecisionSchema,
  myCommunityReportPaginationSchema,
  reportParamsSchema
} from './community.schemas.js';

export const communityRouter = Router();

// Published material is deliberately narrow and contains no reporter data or
// private evidence. Authentication still helps apply abuse controls.
communityRouter.get('/', requireAuth, validate({ query: communityPaginationSchema }), listPublishedCommunityReportsController);
communityRouter.get('/mine', requireAuth, validate({ query: myCommunityReportPaginationSchema }), listMyCommunityReportsController);
communityRouter.post('/', requireAuth, validate({ body: createCommunityReportSchema }), createCommunityReportController);
communityRouter.post('/:reportId/abuse-reports', requireAuth, validate({ params: reportParamsSchema, body: createAbuseReportSchema }), createAbuseReportController);

export const communityModerationRouter = Router();
communityModerationRouter.use(requireAuth, requireRole('moderator', 'admin'));
communityModerationRouter.get('/reports', validate({ query: communityPaginationSchema }), listPendingCommunityReportsController);
communityModerationRouter.post('/reports/:reportId/decision', validate({ params: reportParamsSchema, body: moderationDecisionSchema }), moderateCommunityReportController);
