import mongoose, { type Mongoose } from "mongoose";

const uri = process.env.MONGODB_ACCOUNTING_URI;

if (!uri) {
  throw new Error("Missing MONGODB_ACCOUNTING_URI environment variable");
}

declare global {
  var _mongooseConn: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  } | undefined;
}

const cached = global._mongooseConn ?? { conn: null, promise: null };
global._mongooseConn = cached;

export async function connectAccountingDb(): Promise<Mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri!, { dbName: "accounting" });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
