import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const evidenceReferenceSchema = new Schema(
  {
    evidencePublicId: { type: String, required: true },
    excerpt: { type: String, required: true, maxlength: 240 },
    entityKinds: [{ type: String }],
  },
  { _id: false, strict: "throw" },
);

const analysisFindingSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: "Analysis", index: true },
    code: { type: String, required: true, maxlength: 100 },
    category: { type: String, required: true, maxlength: 100 },
    state: { type: String, enum: ["detected", "not_detected", "unknown"], required: true },
    severity: { type: String, enum: ["info", "low", "medium", "high", "critical"], required: true },
    confidence: { type: String, enum: ["limited", "moderate", "strong"], required: true },
    title: { type: String, required: true, maxlength: 180 },
    explanation: { type: String, required: true, maxlength: 1_500 },
    evidence: { type: [evidenceReferenceSchema], required: true, default: [] },
    recommendedActionKeys: { type: [String], required: true, default: [] },
    patternIds: { type: [String], required: true, default: [] },
    /** Technical details must be allowlisted before persistence and are never raw evidence. */
    technicalDetails: { type: Schema.Types.Mixed, default: undefined, select: false },
    source: { type: String, enum: ["rule", "url", "pattern", "ai", "verification"], required: true },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

analysisFindingSchema.index({ analysisId: 1, severity: -1, createdAt: 1 });
analysisFindingSchema.index({ analysisId: 1, code: 1 }, { unique: true });

export type AnalysisFindingDocument = InferSchemaType<typeof analysisFindingSchema>;
export const AnalysisFinding: Model<AnalysisFindingDocument> =
  (mongoose.models.AnalysisFinding as Model<AnalysisFindingDocument> | undefined) ??
  model<AnalysisFindingDocument>("AnalysisFinding", analysisFindingSchema);
