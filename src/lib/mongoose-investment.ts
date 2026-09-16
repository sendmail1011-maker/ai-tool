import mongoose, { type Connection, type Model } from "mongoose";
import { NewsDigestSchema, type NewsDigest } from "@/models/investment/NewsDigest";
import {
  InstitutionalFlowSchema,
  type InstitutionalFlow,
} from "@/models/investment/InstitutionalFlow";
import {
  InstitutionalFlowAmountSchema,
  type InstitutionalFlowAmount,
} from "@/models/investment/InstitutionalFlowAmount";
import { MarketIndexSchema, type MarketIndex } from "@/models/investment/MarketIndex";
import { FuturesDataSchema, type FuturesData } from "@/models/investment/FuturesData";
import {
  InvestmentReportSchema,
  type InvestmentReport,
} from "@/models/investment/InvestmentReport";

const uri = process.env.MONGODB_INVESTMENT_URI;

if (!uri) {
  throw new Error("Missing MONGODB_INVESTMENT_URI environment variable");
}

// Investment data is kept on its own Mongoose connection (separate from the
// accounting app's default connection in @/lib/mongoose) so nothing here can
// ever touch the accounting database.
declare global {
  var _investmentMongooseConn:
    | {
        conn: Connection | null;
        promise: Promise<Connection> | null;
      }
    | undefined;
}

const cached = global._investmentMongooseConn ?? { conn: null, promise: null };
global._investmentMongooseConn = cached;

async function connectInvestmentDb(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(uri!, { dbName: "investment" })
      .asPromise()
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function getInvestmentModels(): Promise<{
  NewsDigest: Model<NewsDigest>;
  InstitutionalFlow: Model<InstitutionalFlow>;
  InstitutionalFlowAmount: Model<InstitutionalFlowAmount>;
  MarketIndex: Model<MarketIndex>;
  FuturesData: Model<FuturesData>;
  InvestmentReport: Model<InvestmentReport>;
}> {
  const conn = await connectInvestmentDb();

  const NewsDigestModel =
    (conn.models.NewsDigest as Model<NewsDigest> | undefined) ??
    conn.model<NewsDigest>("NewsDigest", NewsDigestSchema);

  const InstitutionalFlowModel =
    (conn.models.InstitutionalFlow as Model<InstitutionalFlow> | undefined) ??
    conn.model<InstitutionalFlow>("InstitutionalFlow", InstitutionalFlowSchema);

  const InstitutionalFlowAmountModel =
    (conn.models.InstitutionalFlowAmount as Model<InstitutionalFlowAmount> | undefined) ??
    conn.model<InstitutionalFlowAmount>("InstitutionalFlowAmount", InstitutionalFlowAmountSchema);

  const MarketIndexModel =
    (conn.models.MarketIndex as Model<MarketIndex> | undefined) ??
    conn.model<MarketIndex>("MarketIndex", MarketIndexSchema);

  const FuturesDataModel =
    (conn.models.FuturesData as Model<FuturesData> | undefined) ??
    conn.model<FuturesData>("FuturesData", FuturesDataSchema);

  const InvestmentReportModel =
    (conn.models.InvestmentReport as Model<InvestmentReport> | undefined) ??
    conn.model<InvestmentReport>("InvestmentReport", InvestmentReportSchema);

  return {
    NewsDigest: NewsDigestModel,
    InstitutionalFlow: InstitutionalFlowModel,
    InstitutionalFlowAmount: InstitutionalFlowAmountModel,
    MarketIndex: MarketIndexModel,
    FuturesData: FuturesDataModel,
    InvestmentReport: InvestmentReportModel,
  };
}
