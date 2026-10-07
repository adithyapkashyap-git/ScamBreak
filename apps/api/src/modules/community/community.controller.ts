import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

import type {
  CreateAbuseReportInput,
  CreateCommunityReportInput,
  ModerationDecisionInput
} from './community.schemas.js';
import {
  createCommunityReport,
  listMyCommunityReports,
  listPendingCommunityReports,
  listPublishedCommunityReports,
  moderateCommunityReport,
  submitCommunityAbuseReport
} from './community.service.js';

export const createCommunityReportController: RequestHandler = asyncHandler(async (req, res) => {
  const report = await createCommunityReport({
    ownerUserId: req.auth!.id,
    requestId: req.requestId,
    body: req.validated?.body as CreateCommunityReportInput
  });
  sendSuccess(res, { report }, 201);
});

export const listPublishedCommunityReportsController: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  sendSuccess(res, { reports: await listPublishedCommunityReports(limit) });
});

export const listMyCommunityReportsController: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  sendSuccess(res, { reports: await listMyCommunityReports(req.auth!.id, limit) });
});

export const createAbuseReportController: RequestHandler = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params as { reportId: string };
  const abuseReport = await submitCommunityAbuseReport({
    reporterUserId: req.auth!.id,
    reportPublicId: reportId,
    body: req.validated?.body as CreateAbuseReportInput,
    requestId: req.requestId
  });
  sendSuccess(res, { abuseReport }, 201);
});

export const listPendingCommunityReportsController: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  sendSuccess(res, { reports: await listPendingCommunityReports(limit) });
});

export const moderateCommunityReportController: RequestHandler = asyncHandler(async (req, res) => {
  const { reportId } = req.validated?.params as { reportId: string };
  const report = await moderateCommunityReport({
    moderatorUserId: req.auth!.id,
    reportPublicId: reportId,
    body: req.validated?.body as ModerationDecisionInput,
    requestId: req.requestId
  });
  sendSuccess(res, { report });
});
