import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

import { createPublicId } from "../analyses/publicId.js";

/**
 * Short-lived staging record for a validated upload. An image can only be
 * attached to an analysis by its owner and is consumed once, avoiding arbitrary
 * object-storage key references in analysis requests.
 */
const uploadSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId("upl") },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    /** Set only after a successful atomic reservation for an analysis. */
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis", index: true },
    kind: { type: String, enum: ["image"], required: true },
    status: { type: String, enum: ["pending_scan", "ready", "rejected", "consumed", "expired"], required: true, default: "pending_scan", index: true },
    storage: {
      provider: { type: String, required: true, maxlength: 40 },
      key: { type: String, required: true, select: false, maxlength: 500 },
      mimeType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] },
      sizeBytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
      sha256: { type: String, required: true, select: false, maxlength: 64 },
      width: { type: Number, min: 1 },
      height: { type: Number, min: 1 },
    },
    /**
     * Deliberately not a Mongo TTL index: a TTL index would delete the upload
     * record while leaving its private object behind. The maintenance service
     * deletes bytes first and then removes this record.
     */
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 80 },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

uploadSchema.index({ ownerUserId: 1, status: 1, createdAt: -1 });

export type UploadDocument = InferSchemaType<typeof uploadSchema>;
export const Upload: Model<UploadDocument> =
  (mongoose.models.Upload as Model<UploadDocument> | undefined) ??
  model<UploadDocument>("Upload", uploadSchema);
