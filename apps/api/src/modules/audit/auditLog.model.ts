import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const auditLogSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('aud') },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, maxlength: 120, index: true },
    resourceType: { type: String, required: true, maxlength: 80, index: true },
    resourcePublicId: { type: String, maxlength: 120, index: true },
    outcome: { type: String, enum: ['success', 'rejected', 'failed'], required: true },
    requestId: { type: String, maxlength: 128 },
    /** Metadata is a tiny allowlisted operational summary, never raw evidence. */
    metadata: { type: Schema.Types.Mixed, select: false }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

auditLogSchema.index({ createdAt: -1, action: 1 });
auditLogSchema.index({ resourceType: 1, resourcePublicId: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;
export const AuditLog: Model<AuditLogDocument> =
  (mongoose.models.AuditLog as Model<AuditLogDocument> | undefined) ?? model<AuditLogDocument>('AuditLog', auditLogSchema);
