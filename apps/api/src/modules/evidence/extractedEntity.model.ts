import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

import { createPublicId } from "../analyses/publicId.js";

const extractedEntitySchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId("ent") },
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: "Analysis", index: true },
    evidenceId: { type: Schema.Types.ObjectId, required: true, ref: "Evidence", index: true },
    kind: {
      type: String,
      enum: ["organization", "person", "email", "phone", "url", "domain", "payment_handle", "bank_instruction", "amount", "currency", "deadline", "requested_action", "product_service", "account_identifier"],
      required: true,
    },
    /** Private raw values are only used for matching and protected worker operations. */
    value: { type: String, required: true, select: false, maxlength: 4_096 },
    normalizedValue: { type: String, required: true, select: false, maxlength: 4_096 },
    displayValue: { type: String, required: true, maxlength: 240 },
    valueHash: { type: String, required: true, index: true, maxlength: 128 },
    classification: { type: String, enum: ["public", "internal", "private", "restricted"], required: true },
    source: { type: String, enum: ["deterministic", "ocr", "ai", "manual"], required: true },
    confidence: { type: String, enum: ["limited", "moderate", "strong"], required: true },
    startOffset: { type: Number, min: 0 },
    endOffset: { type: Number, min: 0 },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

extractedEntitySchema.index({ analysisId: 1, kind: 1 });
extractedEntitySchema.index({ kind: 1, valueHash: 1 });

export type ExtractedEntityDocument = InferSchemaType<typeof extractedEntitySchema>;
export const ExtractedEntity: Model<ExtractedEntityDocument> =
  (mongoose.models.ExtractedEntity as Model<ExtractedEntityDocument> | undefined) ??
  model<ExtractedEntityDocument>("ExtractedEntity", extractedEntitySchema);
