import { Schema, type InferSchemaType } from "mongoose";

export const SLEEP_QUALITIES = ["good", "ok", "poor"] as const;

export const SleepLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    // The day this record covers (typically the morning the user woke up and logged it).
    date: { type: Date, required: true },
    durationHours: { type: Number, required: true },
    quality: { type: String, enum: SLEEP_QUALITIES, required: true },
  },
  { timestamps: true }
);

SleepLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export type SleepLog = InferSchemaType<typeof SleepLogSchema>;
