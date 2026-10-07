import { CampaignCluster } from './campaignCluster.model.js';
import { CampaignRelationship } from './campaignRelationship.model.js';

/**
 * Conservative clustering foundation. It links only already-moderated,
 * opt-in community reports with exact, hashed normalized signals. It does not
 * attempt semantic matching over private messages or reveal relationships.
 */
export async function attachPublishedReportToCampaign(input: {
  communityReportId: unknown;
  category: string;
  signalKinds: string[];
  signalHashes: string[];
}): Promise<void> {
  if (input.signalHashes.length === 0) return;
  const existing = await CampaignRelationship.findOne({
    matchingSignalHashes: { $in: input.signalHashes }
  })
    .sort({ createdAt: -1 })
    .exec();

  const now = new Date();
  if (existing) {
    const cluster = await CampaignCluster.findById(existing.clusterId).exec();
    if (!cluster) return;
    try {
      await CampaignRelationship.create({
        clusterId: cluster._id,
        communityReportId: input.communityReportId,
        matchingSignalKinds: input.signalKinds,
        matchingSignalHashes: input.signalHashes,
        confidence: input.signalHashes.length >= 2 ? 'moderate' : 'limited',
        linkedBy: 'rule'
      });
      await CampaignCluster.updateOne(
        { _id: cluster._id },
        {
          $inc: { reportCount: 1 },
          $set: {
            lastObservedAt: now,
            confidence: input.signalHashes.length >= 2 ? 'moderate' : cluster.confidence
          }
        }
      ).exec();
    } catch (error: unknown) {
      // A uniqueness conflict means a retry or concurrent moderator operation
      // already attached the same report. No user-visible error is needed.
      if (!(typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000)) {
        throw error;
      }
    }
    return;
  }

  const cluster = await CampaignCluster.create({
    category: input.category,
    status: 'possible',
    confidence: 'limited',
    reportCount: 1,
    lastObservedAt: now
  });
  try {
    await CampaignRelationship.create({
      clusterId: cluster._id,
      communityReportId: input.communityReportId,
      matchingSignalKinds: input.signalKinds,
      matchingSignalHashes: input.signalHashes,
      confidence: 'limited',
      linkedBy: 'rule'
    });
  } catch (error) {
    await CampaignCluster.deleteOne({ _id: cluster._id }).exec();
    throw error;
  }
}
