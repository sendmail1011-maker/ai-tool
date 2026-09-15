import { Schema, type InferSchemaType } from "mongoose";

export const CategorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

export type LifeLogCategory = InferSchemaType<typeof CategorySchema>;
