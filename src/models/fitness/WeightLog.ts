import { Schema, type InferSchemaType } from "mongoose";

export const WeightLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    weightKg: { type: Number, required: true },
    note: { type: String },
  },
  { timestamps: true }
);

export type WeightLog = InferSchemaType<typeof WeightLogSchema>;
