import { Schema, type InferSchemaType } from "mongoose";

export const WaterLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    amountMl: { type: Number, required: true },
  },
  { timestamps: true }
);

export type WaterLog = InferSchemaType<typeof WaterLogSchema>;
