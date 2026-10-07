import { config } from '../../config/index.js';
import { isAppError } from '../../lib/AppError.js';
import { logger, safeErrorMetadata } from '../../lib/logger.js';
import { Analysis } from '../analyses/analysis.model.js';
import { analysisService } from '../analyses/analysis.service.js';
import { purgeExpiredImageUploads } from '../evidence/upload.service.js';

type RetentionCandidate = {
  publicId: string;
  ownerUserId: { toString(): string };
};

export type PrivacyMaintenanceResult = Readonly<{
  stagedUploads: { considered: number; purged: number; failed: number };
  analyses: { enabled: boolean; considered: number; deleted: number; failed: number };
}>;

const MAX_ANALYSES_PER_SWEEP = 250;
const HOUR_MS = 60 * 60 * 1_000;

/**
 * Enforces private-data lifecycle rules without exposing evidence values or
 * storage keys to logs. Image staging cleanup always runs; analysis retention
 * is a deployment-level opt-in because its legal basis may vary by operator.
 */
export async function runPrivacyMaintenance(input: { now?: Date; limit?: number } = {}): Promise<PrivacyMaintenanceResult> {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? MAX_ANALYSES_PER_SWEEP, 1), MAX_ANALYSES_PER_SWEEP);
  const stagedUploads = await purgeExpiredImageUploads({ now, limit });

  if (!config.privacy.retentionEnforcementEnabled) {
    return {
      stagedUploads,
      analyses: { enabled: false, considered: 0, deleted: 0, failed: 0 }
    };
  }

  const candidates = await Analysis.aggregate<RetentionCandidate>([
    { $match: { status: { $in: ['draft', 'processing', 'complete', 'failed'] } } },
    {
      $lookup: {
        from: 'users',
        localField: 'ownerUserId',
        foreignField: '_id',
        as: 'owner'
      }
    },
    { $unwind: '$owner' },
    {
      $match: {
        // Deactivated accounts remain in the retention lifecycle so their
        // evidence cannot become an indefinitely retained orphan.
        'owner.status': { $in: ['active', 'deactivated'] },
        $expr: {
          $lte: [
            '$createdAt',
            {
              $dateSubtract: {
                startDate: now,
                unit: 'day',
                amount: { $ifNull: ['$owner.privacy.analysisRetentionDays', config.privacy.analysisRetentionDays] }
              }
            }
          ]
        }
      }
    },
    { $sort: { createdAt: 1, _id: 1 } },
    { $limit: limit },
    { $project: { publicId: 1, ownerUserId: 1 } }
  ]).exec();

  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      await analysisService.remove(candidate.ownerUserId.toString(), candidate.publicId);
      deleted += 1;
    } catch (error) {
      // A concurrent user deletion is already an acceptable terminal state.
      if (isAppError(error) && error.code === 'ANALYSIS_NOT_FOUND') continue;
      failed += 1;
    }
  }

  return {
    stagedUploads,
    analyses: { enabled: true, considered: candidates.length, deleted, failed }
  };
}

/** Starts bounded in-process maintenance for a simple v1 deployment. */
export function startPrivacyMaintenanceScheduler(): () => void {
  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      const result = await runPrivacyMaintenance();
      logger.info(
        {
          operation: 'privacy_maintenance.sweep',
          durationMs: Date.now() - startedAt,
          stagedUploads: result.stagedUploads,
          analyses: result.analyses
        },
        'Privacy maintenance completed'
      );
    } catch (error) {
      logger.error(
        { operation: 'privacy_maintenance.sweep', durationMs: Date.now() - startedAt, ...safeErrorMetadata(error) },
        'Privacy maintenance failed'
      );
    } finally {
      running = false;
    }
  };

  void run();
  const handle = setInterval(() => void run(), config.privacy.maintenanceSweepHours * HOUR_MS);
  handle.unref();
  return () => clearInterval(handle);
}
