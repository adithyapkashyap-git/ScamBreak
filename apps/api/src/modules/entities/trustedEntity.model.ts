import mongoose, { Schema, model, type InferSchemaType, type Model } from "mongoose";

import { createPublicId } from "../analyses/publicId.js";

const supportChannelSchema = new Schema(
  {
    type: { type: String, enum: ["website", "phone", "email", "app", "in_person"], required: true },
    label: { type: String, required: true, maxlength: 120 },
    value: { type: String, required: true, maxlength: 500 },
    /** Whether a moderator has confirmed this particular channel against the source. */
    verified: { type: Boolean, required: true, default: false },
  },
  { _id: false, strict: "throw" },
);

const trustedEntitySchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, immutable: true, default: () => createPublicId("org") },
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    aliases: { type: [String], required: true, default: [] },
    category: { type: String, required: true, maxlength: 80, index: true },
    officialDomains: { type: [String], required: true, default: [] },
    officialApps: {
      type: [{ platform: { type: String, enum: ["ios", "android", "web"], required: true }, identifier: { type: String, required: true, maxlength: 500 } }],
      required: true,
      default: [],
    },
    officialSupportChannels: { type: [supportChannelSchema], required: true, default: [] },
    verificationStatus: { type: String, enum: ["verified", "pending", "retired"], required: true, default: "pending", index: true },
    /** The independent source used by a moderator. Never infer this from submitted evidence. */
    verificationSource: { type: String, maxlength: 1_000 },
    lastVerifiedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

trustedEntitySchema.index({ verificationStatus: 1, category: 1 });
trustedEntitySchema.index({ officialDomains: 1 });
trustedEntitySchema.index({ normalizedName: 1, verificationStatus: 1 });

export type TrustedEntityDocument = InferSchemaType<typeof trustedEntitySchema>;
export const TrustedEntity: Model<TrustedEntityDocument> =
  (mongoose.models.TrustedEntity as Model<TrustedEntityDocument> | undefined) ??
  model<TrustedEntityDocument>("TrustedEntity", trustedEntitySchema);
