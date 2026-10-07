import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const responseActionSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 80 },
    priority: { type: String, enum: ['immediate', 'today', 'next'], required: true },
    title: { type: String, required: true, maxlength: 180 },
    description: { type: String, required: true, maxlength: 1_000 },
    when: { type: String, required: true, maxlength: 300 },
    isSafetyCritical: { type: Boolean, default: false }
  },
  { _id: false, strict: 'throw' }
);

const incidentSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('inc') },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    analysisId: { type: Schema.Types.ObjectId, ref: 'Analysis', index: true },
    interactions: {
      type: [String],
      enum: [
        'clicked_link',
        'entered_password',
        'shared_otp',
        'installed_app',
        'shared_screen',
        'sent_money',
        'shared_financial_details',
        'shared_identity_document',
        'contacted_sender'
      ],
      required: true
    },
    notes: { type: String, select: false, maxlength: 2_000 },
    responsePlan: { type: [responseActionSchema], required: true, default: [] },
    status: { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open', index: true }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

incidentSchema.index({ ownerUserId: 1, createdAt: -1 });

export type IncidentDocument = InferSchemaType<typeof incidentSchema>;
export const Incident: Model<IncidentDocument> =
  (mongoose.models.Incident as Model<IncidentDocument> | undefined) ?? model<IncidentDocument>('Incident', incidentSchema);
