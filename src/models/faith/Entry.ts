import { Schema, type InferSchemaType } from "mongoose";

export const EntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    moodTags: { type: [String], default: [] },
    imageUrl: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

EntrySchema.index({ userId: 1, createdAt: -1 });

export type FaithEntry = InferSchemaType<typeof EntrySchema>;
