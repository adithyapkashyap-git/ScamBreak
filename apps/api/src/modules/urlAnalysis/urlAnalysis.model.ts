import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const providerResultSchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 80 },
    status: { type: String, enum: ["available", "unavailable", "error"], required: true },
    verdict: { type: String, enum: ["malicious", "suspicious", "clean", "unknown"] },
    reference: { type: String, maxlength: 300 },
    observedAt: { type: Date },
  },
  { _id: false, strict: "throw" },
);

const urlAnalysisSchema = new Schema(
  {
    analysisId: { type: Schema.Types.ObjectId, required: true, ref: "Analysis", index: true },
    evidenceId: { type: Schema.Types.ObjectId, required: true, ref: "Evidence", index: true },
    /** Canonical URL is private and is not exposed through default queries. */
    canonicalUrl: { type: String, required: true, select: false, maxlength: 4_096 },
    hostname: { type: String, required: true, maxlength: 255, index: true },
    protocol: { type: String, enum: ["http:", "https:"], required: true },
    safeForRemoteLookup: { type: Boolean, required: true },
    providerResults: { type: [providerResultSchema], required: true, default: [] },
    analyzedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

urlAnalysisSchema.index({ analysisId: 1, evidenceId: 1 });
urlAnalysisSchema.index({ hostname: 1, analyzedAt: -1 });

export type UrlAnalysisDocument = InferSchemaType<typeof urlAnalysisSchema>;
export const UrlAnalysis: Model<UrlAnalysisDocument> =
  (mongoose.models.UrlAnalysis as Model<UrlAnalysisDocument> | undefined) ??
  model<UrlAnalysisDocument>("UrlAnalysis", urlAnalysisSchema);
