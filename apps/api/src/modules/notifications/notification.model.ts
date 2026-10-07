import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose';

import { createPublicId } from '../analyses/publicId.js';

const notificationSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId('ntf') },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    type: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, maxlength: 180 },
    body: { type: String, required: true, maxlength: 800 },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, select: false }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
);

notificationSchema.index({ ownerUserId: 1, readAt: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;
export const Notification: Model<NotificationDocument> =
  (mongoose.models.Notification as Model<NotificationDocument> | undefined) ??
  model<NotificationDocument>('Notification', notificationSchema);
