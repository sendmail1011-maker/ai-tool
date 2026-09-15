import { Schema, type InferSchemaType } from "mongoose";

// One document per stock per trade date — sourced from the official TWSE/TPEx
// open data (net buy/sell shares by foreign investors, investment trusts, and
// dealers). Derived indicators (buy-count breadth, 5-day rollups) are computed
// from this raw data rather than stored separately.
export const InstitutionalFlowSchema = new Schema(
  {
    tradeDate: { type: Date, required: true },
    market: { type: String, enum: ["TWSE", "TPEx"], required: true },
    stockId: { type: String, required: true },
    stockName: { type: String, required: true },
    foreignNetShares: { type: Number, required: true },
    trustNetShares: { type: Number, required: true },
    dealerNetShares: { type: Number, required: true },
    totalNetShares: { type: Number, required: true },
  },
  { timestamps: true }
);

InstitutionalFlowSchema.index(
  { tradeDate: 1, market: 1, stockId: 1 },
  { unique: true }
);

export type InstitutionalFlow = InferSchemaType<typeof InstitutionalFlowSchema>;
