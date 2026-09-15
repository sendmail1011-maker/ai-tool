import { Schema, type InferSchemaType } from "mongoose";

// Market-wide daily buy/sell AMOUNT (NT$) by investor type — a companion to
// InstitutionalFlow (which is per-stock SHARE counts). Sourced from TWSE's
// "三大法人買賣金額統計表" (BFI82U) and TPEx's equivalent summary report, one
// row per market per trade date (not per-stock).
export const InstitutionalFlowAmountSchema = new Schema(
  {
    tradeDate: { type: Date, required: true },
    market: { type: String, enum: ["TWSE", "TPEx"], required: true },
    foreignBuyAmount: { type: Number, required: true },
    foreignSellAmount: { type: Number, required: true },
    foreignNetAmount: { type: Number, required: true },
    trustBuyAmount: { type: Number, required: true },
    trustSellAmount: { type: Number, required: true },
    trustNetAmount: { type: Number, required: true },
    dealerBuyAmount: { type: Number, required: true },
    dealerSellAmount: { type: Number, required: true },
    dealerNetAmount: { type: Number, required: true },
    totalBuyAmount: { type: Number, required: true },
    totalSellAmount: { type: Number, required: true },
    totalNetAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

InstitutionalFlowAmountSchema.index({ tradeDate: 1, market: 1 }, { unique: true });

export type InstitutionalFlowAmount = InferSchemaType<typeof InstitutionalFlowAmountSchema>;
