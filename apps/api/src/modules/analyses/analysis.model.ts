import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

import { createPublicId } from "./publicId.js";

const safeActionSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 80 },
    priority: { type: String, enum: ["immediate", "today", "next"], required: true },
    title: { type: String, required: true, maxlength: 180 },
    description: { type: String, required: true, maxlength: 1_000 },
    when: { type: String, required: true, maxlength: 300 },
    isSafetyCritical: { type: Boolean, default: false },
  },
  { _id: false, strict: "throw" },
);

const verificationStepSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 80 },
    title: { type: String, required: true, maxlength: 180 },
    description: { type: String, required: true, maxlength: 1_000 },
    avoidUntrustedContact: { type: Boolean, required: true, default: true },
  },
  { _id: false, strict: "throw" },
);

const analysisSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId("anl") },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    title: { type: String, trim: true, maxlength: 160 },
    status: { type: String, enum: ["draft", "processing", "complete", "failed", "deleted"], required: true, default: "draft", index: true },
    locale: { type: String, required: true, default: "en", maxlength: 16 },
    evidenceCount: { type: Number, required: true, default: 0, min: 0 },
    findingCount: { type: Number, required: true, default: 0, min: 0 },
    riskLevel: { type: String, enum: ["critical", "high", "medium", "low", "unclear"], default: "unclear", index: true },
    engineVersion: { type: String, required: true, default: "analysis-engine/1.0.0" },
    scoringConfigVersion: { type: String, required: true, default: "risk-score/1.0.0" },
    safeActions: { type: [safeActionSchema], required: true, default: [] },
    verificationSteps: { type: [verificationStepSchema], required: true, default: [] },
    matchedPatternIds: { type: [String], required: true, default: [] },
    analysisLimitations: { type: [String], required: true, default: [] },
    aiStatus: { type: String, enum: ["available", "disabled", "unavailable", "invalid", "error"], default: "disabled" },
    processingError: {
      code: { type: String, maxlength: 80 },
      /** Safe, generic failure detail only. Never persist an upstream provider error body. */
      message: { type: String, maxlength: 240 },
    },
    deletionRequestedAt: { type: Date },
    deletedAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: "throw",
  },
);

analysisSchema.index({ ownerUserId: 1, createdAt: -1, _id: -1 });
analysisSchema.index({ ownerUserId: 1, status: 1, createdAt: -1 });
analysisSchema.index({ status: 1, createdAt: 1 });

export type AnalysisDocument = InferSchemaType<typeof analysisSchema>;
export const Analysis: Model<AnalysisDocument> =
  (mongoose.models.Analysis as Model<AnalysisDocument> | undefined) ??
  model<AnalysisDocument>("Analysis", analysisSchema);
