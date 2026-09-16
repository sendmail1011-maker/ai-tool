import mongoose, { type Connection, type Model } from "mongoose";
import { MoodTagSchema, type FaithMoodTag } from "@/models/faith/MoodTag";
import { EntrySchema, type FaithEntry } from "@/models/faith/Entry";

// Faith notebook data lives on its own Mongoose connection (separate from the
// accounting/fitness/life-log connections) so nothing here can ever touch their data.
const uri = process.env.MONGODB_FAITH_URI;

if (!uri) {
  throw new Error("Missing MONGODB_FAITH_URI environment variable");
}

declare global {
  var _faithMongooseConn:
    | {
        conn: Connection | null;
        promise: Promise<Connection> | null;
      }
    | undefined;
}

const cached = global._faithMongooseConn ?? { conn: null, promise: null };
global._faithMongooseConn = cached;

async function connectFaithDb(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(uri!, { dbName: "faith" })
      .asPromise()
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function getFaithModels(): Promise<{
  MoodTag: Model<FaithMoodTag>;
  Entry: Model<FaithEntry>;
}> {
  const conn = await connectFaithDb();

  const MoodTagModel =
    (conn.models.FaithMoodTag as Model<FaithMoodTag> | undefined) ??
    conn.model<FaithMoodTag>("FaithMoodTag", MoodTagSchema);

  const EntryModel =
    (conn.models.FaithEntry as Model<FaithEntry> | undefined) ??
    conn.model<FaithEntry>("FaithEntry", EntrySchema);

  return { MoodTag: MoodTagModel, Entry: EntryModel };
}
