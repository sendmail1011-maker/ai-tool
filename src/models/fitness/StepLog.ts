import { Schema, type InferSchemaType } from "mongoose";

export const StepLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    steps: { type: Number, required: true },
  },
  { timestamps: true }
);

StepLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export type StepLog = InferSchemaType<typeof StepLogSchema>;
