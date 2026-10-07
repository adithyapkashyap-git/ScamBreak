import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const sharedSignalSchema = new Schema(
  {
    kind: { type: String, enum: ['domain', 'phone', 'email', 'payment_handle'], required: true },
    valueHash: { type: String, required: true, select: false, maxlength: 128, index: true },
    /** Only a moderator may publish a domain; other identifiers stay opaque. */
    displayValue: { type: String, maxlength: 240 },
    visibility: { type: String, enum: ['internal', 'public'], required: true, default: 'internal' }
  },
  { _id: false, strict: 'throw' }
);

const communityReportSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('rpt') },
    reporterUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    sourceAnalysisId: { type: Schema.Types.ObjectId, ref: 'Analysis', index: true },
    category: { type: String, required: true, maxlength: 100, index: true },
    patternId: { type: String, maxlength: 100, index: true },
    occurredOn: { type: Date, index: true },
    /** Never returned outside the reporter/moderation path. */
    privateDescription: { type: String, select: false, maxlength: 1_500 },
    /** Moderator-authored text only. Never promote a submitter description automatically. */
    publicSummary: { type: String, maxlength: 800 },
    sharedSignals: { type: [sharedSignalSchema], required: true, default: [] },
    moderationStatus: { type: String, enum: ['pending', 'published', 'rejected'], default: 'pending', index: true },
    moderatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    moderationNote: { type: String, select: false, maxlength: 1_000 },
    abuseScore: { type: Number, min: 0, max: 100, default: 0 }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

communityReportSchema.index({ moderationStatus: 1, occurredOn: -1, createdAt: -1 });
communityReportSchema.index({ reporterUserId: 1, createdAt: -1 });
communityReportSchema.index({ reporterUserId: 1, sourceAnalysisId: 1 }, { unique: true, sparse: true });
communityReportSchema.index({ category: 1, moderationStatus: 1, createdAt: -1 });

export type CommunityReportDocument = InferSchemaType<typeof communityReportSchema>;
export const CommunityReport: Model<CommunityReportDocument> =
  (mongoose.models.CommunityReport as Model<CommunityReportDocument> | undefined) ??
  model<CommunityReportDocument>('CommunityReport', communityReportSchema);
