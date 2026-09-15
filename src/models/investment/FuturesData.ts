import { Schema, type InferSchemaType } from "mongoose";

// Taiwan index futures (e.g. TX) daily/night-session quotes from the official
// TAIFEX open data.
export const FuturesDataSchema = new Schema(
  {
    tradeDate: { type: Date, required: true },
    session: { type: String, enum: ["day", "night"], required: true },
    contractCode: { type: String, required: true },
    close: { type: Number, required: true },
    changePercent: { type: Number },
    volume: { type: Number },
  },
  { timestamps: true }
);

FuturesDataSchema.index(
  { tradeDate: 1, session: 1, contractCode: 1 },
  { unique: true }
);

export type FuturesData = InferSchemaType<typeof FuturesDataSchema>;
