import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const campaignClusterSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('cmp') },
    category: { type: String, required: true, maxlength: 100, index: true },
    status: { type: String, enum: ['possible', 'confirmed', 'retired'], default: 'possible', index: true },
    confidence: { type: String, enum: ['limited', 'moderate', 'strong'], default: 'limited' },
    reportCount: { type: Number, default: 0, min: 0 },
    lastObservedAt: { type: Date, index: true },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    notes: { type: String, select: false, maxlength: 2_000 }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

campaignClusterSchema.index({ status: 1, lastObservedAt: -1 });

export type CampaignClusterDocument = InferSchemaType<typeof campaignClusterSchema>;
export const CampaignCluster: Model<CampaignClusterDocument> =
  (mongoose.models.CampaignCluster as Model<CampaignClusterDocument> | undefined) ??
  model<CampaignClusterDocument>('CampaignCluster', campaignClusterSchema);
