import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { Analysis } from '../analyses/analysis.model.js';
import { AuditLog } from '../audit/auditLog.model.js';
import { AbuseReport } from '../community/abuseReport.model.js';
import { CommunityReport } from '../community/communityReport.model.js';
import { ScamPattern } from '../patterns/scamPattern.model.js';
import { TrustedEntity } from '../entities/trustedEntity.model.js';

export const adminOverview: RequestHandler = asyncHandler(async (_req, res) => {
  const [pendingReports, openAbuseReports, analysesByRisk, patterns, entities] = await Promise.all([
    CommunityReport.countDocuments({ moderationStatus: 'pending' }),
    AbuseReport.countDocuments({ status: 'open' }),
    Analysis.aggregate([
      { $match: { status: 'complete' } },
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
    ]),
    ScamPattern.countDocuments({ status: 'active' }),
    TrustedEntity.countDocuments({ verificationStatus: 'verified' })
  ]);
  sendSuccess(res, {
    moderation: { pendingReports, openAbuseReports },
    system: {
      activePatterns: patterns,
      verifiedEntities: entities,
      analysesByRisk: analysesByRisk.map((entry) => ({ level: entry._id, count: entry.count }))
    }
  });
});

export const listAuditLogs: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  const entries = await AuditLog.find()
    .select({ publicId: 1, action: 1, resourceType: 1, resourcePublicId: 1, outcome: 1, requestId: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
  sendSuccess(res, {
    entries: entries.map((entry) => ({
      id: entry.publicId,
      action: entry.action,
      resourceType: entry.resourceType,
      ...(entry.resourcePublicId ? { resourceId: entry.resourcePublicId } : {}),
      outcome: entry.outcome,
      ...(entry.requestId ? { requestId: entry.requestId } : {}),
      createdAt: entry.createdAt.toISOString()
    }))
  });
});

export const listAbuseReports: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  const reports = await AbuseReport.find({ status: 'open' })
    .select({ publicId: 1, communityReportId: 1, reason: 1, status: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean()
    .exec();
  sendSuccess(res, {
    reports: reports.map((report) => ({
      id: report.publicId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt.toISOString()
    }))
  });
});
