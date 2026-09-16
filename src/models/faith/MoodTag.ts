import { Schema, type InferSchemaType } from "mongoose";

export const MoodTagSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 10 },
    isDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MoodTagSchema.index({ userId: 1, name: 1 }, { unique: true });

export type FaithMoodTag = InferSchemaType<typeof MoodTagSchema>;
