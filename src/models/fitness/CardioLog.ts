import { Schema, type InferSchemaType } from "mongoose";

export const CARDIO_ACTIVITY_TYPES = ["walk", "run", "cycle", "swim", "other"] as const;

export const CardioLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    activityType: { type: String, enum: CARDIO_ACTIVITY_TYPES, required: true },
    durationMinutes: { type: Number, required: true },
    distanceKm: { type: Number },
    estimatedCaloriesBurned: { type: Number, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export type CardioLog = InferSchemaType<typeof CardioLogSchema>;
