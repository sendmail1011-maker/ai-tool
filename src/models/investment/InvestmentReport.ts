import { Schema, type InferSchemaType } from "mongoose";

const RecommendationSchema = new Schema(
  {
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["stock", "etf"], required: true },
    watchReason: { type: String, required: true },
    holdingPeriod: { type: String, required: true },
    potentialUpside: { type: String, required: true },
    riskFactors: { type: [String], required: true },
  },
  { _id: false }
);

// One row per manual "generate today's report" trigger. Reports are never
// overwritten in place — history is kept so past AI recommendations can later
// be reviewed against what the market actually did.
export const InvestmentReportSchema = new Schema(
  {
    reportDate: { type: Date, required: true },
    newsSummary: { type: String, required: true },
    newsRefs: { type: [Schema.Types.ObjectId], default: [] },
    institutionalSummary: { type: String, required: true },
    recommendations: { type: [RecommendationSchema], required: true },
    disclaimer: { type: String, required: true },
    generatedBy: { type: Schema.Types.ObjectId, required: true },
    generatedAt: { type: Date, required: true },
    model: { type: String, required: true },
  },
  { timestamps: true }
);

InvestmentReportSchema.index({ reportDate: -1 });

export type InvestmentReport = InferSchemaType<typeof InvestmentReportSchema>;
