import { Schema, type InferSchemaType } from "mongoose";

const MealGuidanceSchema = new Schema(
  {
    meal: { type: String, required: true },
    suggestion: { type: String, required: true },
  },
  { _id: false }
);

export const DietPlanSchema = new Schema(
  {
    // One current diet plan per user — regenerated on demand (weight/goal change),
    // not on a weekly cadence like WorkoutPlan.
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    dailyCalories: { type: Number, required: true },
    proteinG: { type: Number, required: true },
    carbsG: { type: Number, required: true },
    fatG: { type: Number, required: true },
    mealGuidance: { type: [MealGuidanceSchema], required: true },
    avoid: { type: [String], default: [] },
    summary: { type: String, required: true },
    basedOnWeightKg: { type: Number, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type DietPlan = InferSchemaType<typeof DietPlanSchema>;
