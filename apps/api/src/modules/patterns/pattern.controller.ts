import type { RequestHandler } from 'express';

import { AppError } from '../../lib/AppError.js';
import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { recordAuditEvent } from '../audit/audit.service.js';

import { ScamPattern } from './scamPattern.model.js';
import type { PatternInput } from './pattern.schemas.js';
import { builtInPatternTaxonomy } from './patternTaxonomy.js';

function toPublicPattern(pattern: {
  patternId: string;
  category: string;
  name: string;
  description: string;
  severity: string;
  applicableChannels: string[];
  aliases: string[];
  version: string;
}): Record<string, unknown> {
  return {
    id: pattern.patternId,
    category: pattern.category,
    name: pattern.name,
    description: pattern.description,
    severity: pattern.severity,
    applicableChannels: pattern.applicableChannels,
    aliases: pattern.aliases,
    version: pattern.version
  };
}

export const listPublicPatterns: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  const patterns = await ScamPattern.find({ status: 'active' })
    .select({ patternId: 1, category: 1, name: 1, description: 1, severity: 1, applicableChannels: 1, aliases: 1, version: 1 })
    .sort({ category: 1, name: 1 })
    .limit(limit)
    .lean()
    .exec();
  // Before initial database seeding, still make the curated built-in taxonomy
  // visible. It does not include user-submitted content.
  const source = patterns.length > 0 ? patterns : builtInPatternTaxonomy;
  sendSuccess(res, { patterns: source.map(toPublicPattern) });
});

export const listAdminPatterns: RequestHandler = asyncHandler(async (_req, res) => {
  const patterns = await ScamPattern.find()
    .select({ patternId: 1, category: 1, name: 1, description: 1, indicators: 1, severity: 1, applicableChannels: 1, recommendedProtectiveActions: 1, aliases: 1, examples: 1, version: 1, status: 1, source: 1, lastReviewedAt: 1 })
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
  sendSuccess(res, { patterns });
});

export const upsertPattern: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validated?.body as PatternInput;
  const pattern = await ScamPattern.findOneAndUpdate(
    { patternId: body.patternId },
    {
      $set: {
        ...body,
        source: 'admin',
        lastReviewedAt: new Date(),
        createdByUserId: req.auth!.id
      }
    },
    { upsert: true, new: true, runValidators: true }
  ).exec();
  if (!pattern) throw new AppError(500, 'PATTERN_WRITE_FAILED', 'The pattern could not be saved.');
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'pattern.upsert',
    resourceType: 'scam_pattern',
    resourcePublicId: pattern.patternId,
    outcome: 'success',
    requestId: req.requestId,
    metadata: { status: pattern.status }
  });
  sendSuccess(res, { pattern: toPublicPattern(pattern) });
});
