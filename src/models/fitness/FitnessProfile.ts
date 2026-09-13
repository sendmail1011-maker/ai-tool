import { Schema, type InferSchemaType } from "mongoose";

export const FITNESS_GENDERS = ["male", "female", "other"] as const;
export const FITNESS_ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export const FITNESS_GOAL_TYPES = [
  "lose_weight",
  "gain_weight",
  "maintain",
  "body_recomposition",
  "custom",
] as const;
export const FITNESS_ENVIRONMENTS = ["gym", "home", "none"] as const;

export const FitnessProfileSchema = new Schema(
  {
    // Fitness data lives on its own Mongo connection/DB (see @/lib/mongoose-fitness),
    // so this is a plain ObjectId, not a ref into the accounting DB's User collection.
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    gender: { type: String, enum: FITNESS_GENDERS, required: true },
    birthYear: { type: Number, required: true },
    heightCm: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    activityLevel: { type: String, enum: FITNESS_ACTIVITY_LEVELS, required: true },
    goalType: { type: String, enum: FITNESS_GOAL_TYPES, required: true },
    // Free-text description of the goal — required when goalType is "custom",
    // optional extra detail otherwise (e.g. refining a preset goal in the user's own words).
    goalText: { type: String },
    targetWeightKg: { type: Number },
    targetTimeframeWeeks: { type: Number, required: true },
    workoutFrequencyPerWeek: { type: Number, required: true },
    environment: { type: String, enum: FITNESS_ENVIRONMENTS, required: true },
    dietaryNotes: { type: String },
    freeTextNote: { type: String },
    aiAnalysis: {
      bmr: Number,
      tdee: Number,
      recommendedDailyCalories: Number,
      summary: String,
      recommendations: [String],
      analyzedAt: Date,
    },
  },
  { timestamps: true }
);

export type FitnessProfile = InferSchemaType<typeof FitnessProfileSchema>;
