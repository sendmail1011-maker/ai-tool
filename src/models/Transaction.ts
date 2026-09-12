import { Schema, models, model, type InferSchemaType } from "mongoose";
import { ACCOUNTING_GROUPS } from "@/lib/accountingCategories";

const TransactionSchema = new Schema(
  {
    rawText: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    type: { type: String, enum: ["expense", "income"], required: true },
    group: { type: String, enum: ACCOUNTING_GROUPS, required: true },
    subCategory: { type: String, required: true },
    amount: { type: Number, required: true },
    item: { type: String, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

export type Transaction = InferSchemaType<typeof TransactionSchema>;

export default models.Transaction ?? model("Transaction", TransactionSchema);
