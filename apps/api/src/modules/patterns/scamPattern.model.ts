import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

const scamPatternSchema = new Schema(
  {
    patternId: { type: String, required: true, unique: true, immutable: true, maxlength: 100 },
    category: { type: String, required: true, maxlength: 100, index: true },
    name: { type: String, required: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 2_000 },
    indicators: {
      anyFindingCodes: { type: [String], required: true, default: [] },
      allFindingCodes: { type: [String], required: true, default: [] },
      entityKinds: { type: [String], required: true, default: [] },
      minMatchedIndicators: { type: Number, required: true, min: 1, default: 1 },
    },
    severity: { type: String, enum: ["info", "low", "medium", "high", "critical"], required: true },
    applicableChannels: { type: [String], required: true, default: ["unknown"] },
    recommendedProtectiveActions: { type: [String], required: true, default: [] },
    aliases: { type: [String], required: true, default: [] },
    examples: { type: [String], required: true, default: [] },
    version: { type: String, required: true, maxlength: 40 },
    status: { type: String, enum: ["active", "retired", "draft"], required: true, default: "draft", index: true },
    source: { type: String, enum: ["built_in", "admin", "import"], required: true, default: "admin" },
    lastReviewedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

scamPatternSchema.index({ status: 1, category: 1 });
scamPatternSchema.index({ "indicators.anyFindingCodes": 1 });

export type ScamPatternDocument = InferSchemaType<typeof scamPatternSchema>;
export const ScamPattern: Model<ScamPatternDocument> =
  (mongoose.models.ScamPattern as Model<ScamPatternDocument> | undefined) ??
  model<ScamPatternDocument>("ScamPattern", scamPatternSchema);
