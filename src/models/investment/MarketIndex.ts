import { Schema, type InferSchemaType } from "mongoose";

// Daily close for an index or single stock. Taiwan symbols come from the
// official TWSE open data; international indices/US stocks come from Yahoo
// Finance (see lib note on that source's caveats).
export const MarketIndexSchema = new Schema(
  {
    date: { type: Date, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    source: { type: String, enum: ["TWSE", "YAHOO"], required: true },
    close: { type: Number, required: true },
    changePercent: { type: Number },
  },
  { timestamps: true }
);

MarketIndexSchema.index({ date: 1, symbol: 1 }, { unique: true });

export type MarketIndex = InferSchemaType<typeof MarketIndexSchema>;
