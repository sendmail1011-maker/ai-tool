import { Schema, type InferSchemaType } from "mongoose";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export const MealLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    description: { type: String, required: true },
    estimatedCalories: { type: Number, required: true },
    proteinG: { type: Number, required: true },
    carbsG: { type: Number, required: true },
    fatG: { type: Number, required: true },
    feedback: { type: String },
  },
  { timestamps: true }
);

export type MealLog = InferSchemaType<typeof MealLogSchema>;
