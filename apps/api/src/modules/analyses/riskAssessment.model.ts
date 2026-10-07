import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const contributionSchema = new Schema(
  {
    findingCode: { type: String, required: true, maxlength: 100 },
    points: { type: Number, required: true, min: 0, max: 100 },
    reason: { type: String, required: true, maxlength: 300 },
  },
  { _id: false, strict: "throw" },
);

const riskAssessmentSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: "Analysis", unique: true },
    level: { type: String, enum: ["critical", "high", "medium", "low", "unclear"], required: true },
    /** A deterministic indicator score, explicitly not a probability of fraud. */
    score: { type: Number, min: 0, max: 100, default: null },
    confidence: { type: String, enum: ["limited", "moderate", "strong"], required: true },
    rationale: { type: [String], required: true, default: [] },
    limitations: { type: [String], required: true, default: [] },
    engineVersion: { type: String, required: true, maxlength: 80 },
    scoringConfigVersion: { type: String, required: true, maxlength: 80 },
    contributions: { type: [contributionSchema], required: true, default: [] },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

export type RiskAssessmentDocument = InferSchemaType<typeof riskAssessmentSchema>;
export const RiskAssessment: Model<RiskAssessmentDocument> =
  (mongoose.models.RiskAssessment as Model<RiskAssessmentDocument> | undefined) ??
  model<RiskAssessmentDocument>("RiskAssessment", riskAssessmentSchema);
