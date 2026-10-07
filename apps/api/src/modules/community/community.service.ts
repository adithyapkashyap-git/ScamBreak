import { AppError } from '../../lib/AppError.js';
import { Types } from 'mongoose';
import { recordAuditEvent } from '../audit/audit.service.js';
import { attachPublishedReportToCampaign } from '../campaigns/campaignClustering.service.js';
import { Analysis } from '../analyses/analysis.model.js';
import { redactSensitiveText } from '../analyses/dataSanitization.js';
import { ExtractedEntity } from '../evidence/extractedEntity.model.js';

import { AbuseReport } from './abuseReport.model.js';
import { CommunityReport } from './communityReport.model.js';
import type {
  CreateAbuseReportInput,
  CreateCommunityReportInput,
  ModerationDecisionInput
} from './community.schemas.js';

type SharedSignal = {
  kind: 'domain' | 'phone' | 'email' | 'payment_handle';
  valueHash: string;
  displayValue?: string;
  visibility: 'internal' | 'public';
};

type PublicCommunityReport = {
  id: string;
  category: string;
  patternId?: string;
  occurredOn?: string;
  summary: string;
  publishedAt: string;
  sharedDomains: string[];
};

type MyCommunityReport = {
  id: string;
  category: string;
  patternId?: string;
  moderationStatus: string;
  occurredOn?: string;
  createdAt: string;
};

const publicSignalKinds = new Set(['domain']);

async function deriveOptInSignals(input: {
  ownerUserId: string;
  analysisPublicId: string;
  requestedKinds: Array<'domain' | 'phone' | 'email' | 'payment_handle'>;
}): Promise<{ analysisId: unknown; signals: SharedSignal[] }> {
  const analysis = await Analysis.findOne({
    ownerUserId: input.ownerUserId,
    publicId: input.analysisPublicId,
    status: 'complete'
  }).exec();
  if (!analysis) {
    throw new AppError(404, 'ANALYSIS_NOT_FOUND', 'The selected completed analysis was not found.');
  }

  if (input.requestedKinds.length === 0) return { analysisId: analysis._id, signals: [] };
  const entities = await ExtractedEntity.find({
    analysisId: analysis._id,
    kind: { $in: input.requestedKinds }
  }).exec();
  const signals = new Map<string, SharedSignal>();
  for (const entity of entities) {
    if (!input.requestedKinds.includes(entity.kind as SharedSignal['kind'])) continue;
    const kind = entity.kind as SharedSignal['kind'];
    const key = `${kind}:${entity.valueHash}`;
    if (!signals.has(key)) {
      signals.set(key, {
        kind,
        valueHash: entity.valueHash,
        // Domains may be published only after moderation. All other submitted
        // identifiers remain opaque even in published reports.
        ...(publicSignalKinds.has(kind) ? { displayValue: entity.displayValue } : {}),
        visibility: 'internal'
      });
    }
  }
  return { analysisId: analysis._id, signals: [...signals.values()] };
}

function toPublicCommunityReport(report: {
  publicId: string;
  category: string;
  patternId?: string | null;
  occurredOn?: Date | null;
  publicSummary?: string | null;
  moderatedAt?: Date | null;
  createdAt: Date;
  sharedSignals: Array<{ kind: string; displayValue?: string | null; visibility: string }>;
}): PublicCommunityReport {
  return {
    id: report.publicId,
    category: report.category,
    ...(report.patternId ? { patternId: report.patternId } : {}),
    ...(report.occurredOn ? { occurredOn: report.occurredOn.toISOString().slice(0, 10) } : {}),
    summary: report.publicSummary ?? 'A moderated community report was published.',
    publishedAt: (report.moderatedAt ?? report.createdAt).toISOString(),
    sharedDomains: report.sharedSignals
      .filter((signal) => signal.kind === 'domain' && signal.visibility === 'public' && Boolean(signal.displayValue))
      .map((signal) => signal.displayValue!)
  };
}

function toMine(report: {
  publicId: string;
  category: string;
  patternId?: string | null;
  moderationStatus: string;
  occurredOn?: Date | null;
  createdAt: Date;
}): MyCommunityReport {
  return {
    id: report.publicId,
    category: report.category,
    ...(report.patternId ? { patternId: report.patternId } : {}),
    moderationStatus: report.moderationStatus,
    ...(report.occurredOn ? { occurredOn: report.occurredOn.toISOString().slice(0, 10) } : {}),
    createdAt: report.createdAt.toISOString()
  };
}

export async function createCommunityReport(input: {
  ownerUserId: string;
  requestId?: string;
  body: CreateCommunityReportInput;
}): Promise<MyCommunityReport> {
  const linked = input.body.analysisId
    ? await deriveOptInSignals({
        ownerUserId: input.ownerUserId,
        analysisPublicId: input.body.analysisId,
        requestedKinds: input.body.shareSignalKinds
      })
    : { analysisId: undefined, signals: [] };

  try {
    const report = await CommunityReport.create({
      reporterUserId: input.ownerUserId,
      ...(linked.analysisId ? { sourceAnalysisId: linked.analysisId } : {}),
      category: input.body.category,
      ...(input.body.patternId ? { patternId: input.body.patternId } : {}),
      ...(input.body.occurredOn ? { occurredOn: input.body.occurredOn } : {}),
      ...(input.body.description ? { privateDescription: redactSensitiveText(input.body.description, 1_500) } : {}),
      sharedSignals: linked.signals,
      moderationStatus: 'pending'
    });
    await recordAuditEvent({
      actorUserId: input.ownerUserId,
      action: 'community_report.create',
      resourceType: 'community_report',
      resourcePublicId: report.publicId,
      outcome: 'success',
      requestId: input.requestId,
      metadata: { hasAnalysis: Boolean(linked.analysisId), signalCount: linked.signals.length }
    });
    return toMine(report);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000) {
      throw new AppError(409, 'DUPLICATE_COMMUNITY_REPORT', 'You have already submitted a community report for that analysis.');
    }
    throw error;
  }
}

export async function listPublishedCommunityReports(limit: number): Promise<PublicCommunityReport[]> {
  const reports = await CommunityReport.find({ moderationStatus: 'published' })
    .select({ publicId: 1, category: 1, patternId: 1, occurredOn: 1, publicSummary: 1, moderatedAt: 1, createdAt: 1, sharedSignals: 1 })
    .sort({ occurredOn: -1, createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
  return reports.map(toPublicCommunityReport);
}

export async function listMyCommunityReports(ownerUserId: string, limit: number): Promise<MyCommunityReport[]> {
  const reports = await CommunityReport.find({ reporterUserId: ownerUserId })
    .select({ publicId: 1, category: 1, patternId: 1, moderationStatus: 1, occurredOn: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
  return reports.map(toMine);
}

export async function submitCommunityAbuseReport(input: {
  reporterUserId: string;
  reportPublicId: string;
  body: CreateAbuseReportInput;
  requestId?: string;
}): Promise<{ id: string; status: string }> {
  const report = await CommunityReport.findOne({ publicId: input.reportPublicId, moderationStatus: 'published' }).exec();
  if (!report) throw new AppError(404, 'COMMUNITY_REPORT_NOT_FOUND', 'The community report was not found.');
  if (report.reporterUserId.toString() === input.reporterUserId) {
    throw new AppError(400, 'INVALID_ABUSE_REPORT', 'You cannot submit an abuse report about your own community report.');
  }
  try {
    const abuse = await AbuseReport.create({
      reporterUserId: input.reporterUserId,
      communityReportId: report._id,
      reason: input.body.reason,
      ...(input.body.detail ? { detail: redactSensitiveText(input.body.detail, 1_000) } : {})
    });
    await recordAuditEvent({
      actorUserId: input.reporterUserId,
      action: 'community_report.abuse_report',
      resourceType: 'community_report',
      resourcePublicId: report.publicId,
      outcome: 'success',
      requestId: input.requestId,
      metadata: { reason: input.body.reason }
    });
    return { id: abuse.publicId, status: abuse.status };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000) {
      throw new AppError(409, 'DUPLICATE_ABUSE_REPORT', 'You have already reported this community item.');
    }
    throw error;
  }
}

export async function listPendingCommunityReports(limit: number): Promise<Array<{
  id: string;
  category: string;
  patternId?: string;
  occurredOn?: string;
  privateDescription?: string;
  signalKinds: string[];
  createdAt: string;
}>> {
  const reports = await CommunityReport.find({ moderationStatus: 'pending' })
    .select('+privateDescription')
    .sort({ createdAt: 1 })
    .limit(limit)
    .exec();
  return reports.map((report) => ({
    id: report.publicId,
    category: report.category,
    ...(report.patternId ? { patternId: report.patternId } : {}),
    ...(report.occurredOn ? { occurredOn: report.occurredOn.toISOString().slice(0, 10) } : {}),
    ...(report.privateDescription ? { privateDescription: report.privateDescription } : {}),
    signalKinds: report.sharedSignals.map((signal) => signal.kind),
    createdAt: report.createdAt.toISOString()
  }));
}

export async function moderateCommunityReport(input: {
  moderatorUserId: string;
  reportPublicId: string;
  body: ModerationDecisionInput;
  requestId?: string;
}): Promise<PublicCommunityReport | { id: string; moderationStatus: 'rejected' }> {
  const report = await CommunityReport.findOne({ publicId: input.reportPublicId, moderationStatus: 'pending' })
    .select('+sharedSignals.valueHash')
    .exec();
  if (!report) throw new AppError(404, 'PENDING_COMMUNITY_REPORT_NOT_FOUND', 'The pending community report was not found.');

  const moderatedAt = new Date();
  if (input.body.decision === 'rejected') {
    report.moderationStatus = 'rejected';
    report.moderatedByUserId = new Types.ObjectId(input.moderatorUserId);
    report.moderatedAt = moderatedAt;
    if (input.body.moderationNote) report.moderationNote = input.body.moderationNote;
    await report.save();
    await recordAuditEvent({
      actorUserId: input.moderatorUserId,
      action: 'community_report.moderate',
      resourceType: 'community_report',
      resourcePublicId: report.publicId,
      outcome: 'success',
      requestId: input.requestId,
      metadata: { decision: 'rejected' }
    });
    return { id: report.publicId, moderationStatus: 'rejected' };
  }

  report.moderationStatus = 'published';
  report.publicSummary = input.body.publicSummary!;
  report.moderatedByUserId = new Types.ObjectId(input.moderatorUserId);
  report.moderatedAt = moderatedAt;
  if (input.body.moderationNote) report.moderationNote = input.body.moderationNote;
  for (const signal of report.sharedSignals) {
    // Only reviewed domains can be visible. Never publish contact/payment IDs.
    signal.visibility = signal.kind === 'domain' && Boolean(signal.displayValue) ? 'public' : 'internal';
  }
  await report.save();
  await attachPublishedReportToCampaign({
    communityReportId: report._id,
    category: report.category,
    signalKinds: report.sharedSignals.map((signal) => signal.kind),
    signalHashes: report.sharedSignals.map((signal) => signal.valueHash)
  });
  await recordAuditEvent({
    actorUserId: input.moderatorUserId,
    action: 'community_report.moderate',
    resourceType: 'community_report',
    resourcePublicId: report.publicId,
    outcome: 'success',
    requestId: input.requestId,
    metadata: { decision: 'published', sharedSignalCount: report.sharedSignals.length }
  });
  return toPublicCommunityReport(report);
}
