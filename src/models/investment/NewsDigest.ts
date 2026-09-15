import { Schema, type InferSchemaType } from "mongoose";

export const NewsDigestSchema = new Schema(
  {
    title: { type: String, required: true },
    source: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    publishedAt: { type: Date, required: true },
    summary: { type: String },
    category: {
      type: String,
      enum: ["taiwan", "international", "macro", "company"],
      default: "taiwan",
    },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

NewsDigestSchema.index({ publishedAt: -1 });

export type NewsDigest = InferSchemaType<typeof NewsDigestSchema>;
