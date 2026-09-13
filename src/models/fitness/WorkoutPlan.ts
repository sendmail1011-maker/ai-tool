import { Schema, type InferSchemaType } from "mongoose";

const ExerciseSchema = new Schema(
  {
    name: { type: String, required: true },
    sets: { type: Number, required: true },
    reps: { type: String, required: true },
    restSeconds: { type: Number },
    notes: { type: String },
  },
  { _id: false }
);

const DayPlanSchema = new Schema(
  {
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    label: { type: String, required: true },
    isRestDay: { type: Boolean, required: true, default: false },
    exercises: { type: [ExerciseSchema], default: [] },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

export const WorkoutPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    // Monday 00:00 local time of the week this plan covers — one document per
    // user per week, so "expired" just means no document matches this week yet.
    weekStart: { type: Date, required: true },
    weekSummary: { type: String, required: true },
    days: { type: [DayPlanSchema], required: true },
    basedOnWeightKg: { type: Number, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

WorkoutPlanSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export type WorkoutPlan = InferSchemaType<typeof WorkoutPlanSchema>;
