import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * A private relationship edge. It stores hashed/normalized signal references,
 * not raw user evidence, and is deliberately not exposed by a public API.
 */
const campaignRelationshipSchema = new Schema(
  {
    clusterId: { type: Schema.Types.ObjectId, required: true, ref: 'CampaignCluster', index: true },
    communityReportId: { type: Schema.Types.ObjectId, required: true, ref: 'CommunityReport', unique: true, index: true },
    matchingSignalKinds: { type: [String], required: true, default: [] },
    matchingSignalHashes: { type: [String], required: true, default: [], select: false },
    confidence: { type: String, enum: ['limited', 'moderate', 'strong'], required: true },
    linkedBy: { type: String, enum: ['rule', 'moderator'], required: true },
    linkedByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

campaignRelationshipSchema.index({ clusterId: 1, createdAt: -1 });

export type CampaignRelationshipDocument = InferSchemaType<typeof campaignRelationshipSchema>;
export const CampaignRelationship: Model<CampaignRelationshipDocument> =
  (mongoose.models.CampaignRelationship as Model<CampaignRelationshipDocument> | undefined) ??
  model<CampaignRelationshipDocument>('CampaignRelationship', campaignRelationshipSchema);
