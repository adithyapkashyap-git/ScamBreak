import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const abuseReportSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('abr') },
    reporterUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    communityReportId: { type: Schema.Types.ObjectId, required: true, ref: 'CommunityReport', index: true },
    reason: { type: String, enum: ['privacy', 'harassment', 'false_information', 'spam', 'other'], required: true },
    detail: { type: String, select: false, maxlength: 1_000 },
    status: { type: String, enum: ['open', 'reviewed', 'closed'], default: 'open', index: true },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

abuseReportSchema.index({ communityReportId: 1, reporterUserId: 1 }, { unique: true });
abuseReportSchema.index({ status: 1, createdAt: -1 });

export type AbuseReportDocument = InferSchemaType<typeof abuseReportSchema>;
export const AbuseReport: Model<AbuseReportDocument> =
  (mongoose.models.AbuseReport as Model<AbuseReportDocument> | undefined) ??
  model<AbuseReportDocument>('AbuseReport', abuseReportSchema);
