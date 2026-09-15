import { Schema, type InferSchemaType } from "mongoose";

export const EntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    categoryName: { type: String, required: true },
    categoryIcon: { type: String, required: true },
    note: { type: String, trim: true, default: "" },
    minutes: { type: Number, required: true, min: 1, max: 1440 },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

EntrySchema.index({ userId: 1, date: 1 });

export type LifeLogEntry = InferSchemaType<typeof EntrySchema>;
