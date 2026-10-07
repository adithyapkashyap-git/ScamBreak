import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

import { createPublicId } from "../analyses/publicId.js";

const evidenceSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId("evd") },
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: "Analysis", index: true },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    type: {
      type: String,
      enum: ["text", "image", "url", "email", "message", "payment_request", "call_transcript", "website_copy", "manual"],
      required: true,
    },
    channel: { type: String, enum: ["sms", "email", "chat", "social_media", "marketplace", "phone_call", "website", "unknown"], default: "unknown" },
    label: { type: String, trim: true, maxlength: 120 },
    displaySummary: { type: String, required: true, maxlength: 300 },
    classification: { type: String, enum: ["private", "restricted"], required: true, default: "private" },
    content: {
      /** select:false prevents incidental return from queries. Explicitly request only in worker paths. */
      rawText: { type: String, select: false, maxlength: 50_000 },
      normalizedText: { type: String, select: false, maxlength: 50_000 },
      ocrText: { type: String, select: false, maxlength: 50_000 },
      submittedUrl: { type: String, select: false, maxlength: 4_096 },
    },
    storage: {
      provider: { type: String, maxlength: 40 },
      key: { type: String, select: false, maxlength: 500 },
      mimeType: { type: String, maxlength: 120 },
      sizeBytes: { type: Number, min: 0, max: 10 * 1024 * 1024 },
      sha256: { type: String, select: false, maxlength: 64 },
      scanStatus: { type: String, enum: ["pending", "clean", "rejected", "unavailable"], default: "unavailable" },
    },
    metadata: {
      senderLabel: { type: String, select: false, maxlength: 160 },
      receivedAt: { type: Date },
      languageHint: { type: String, maxlength: 24 },
    },
    extractionStatus: { type: String, enum: ["pending", "complete", "failed", "unavailable"], required: true, default: "pending" },
    extractionErrorCode: { type: String, maxlength: 80 },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

evidenceSchema.index({ analysisId: 1, createdAt: 1 });
evidenceSchema.index({ ownerUserId: 1, createdAt: -1 });

export type EvidenceDocument = InferSchemaType<typeof evidenceSchema>;
export const Evidence: Model<EvidenceDocument> =
  (mongoose.models.Evidence as Model<EvidenceDocument> | undefined) ??
  model<EvidenceDocument>("Evidence", evidenceSchema);
