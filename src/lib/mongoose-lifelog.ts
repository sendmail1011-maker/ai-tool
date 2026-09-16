import mongoose, { type Connection, type Model } from "mongoose";
import { CategorySchema, type LifeLogCategory } from "@/models/lifelog/Category";
import { EntrySchema, type LifeLogEntry } from "@/models/lifelog/Entry";

// Life-log data lives on its own Mongoose connection (separate from the
// accounting/fitness connections) so nothing here can ever touch their data.
const uri = process.env.MONGODB_LIFE_LOG_URI;

if (!uri) {
  throw new Error("Missing MONGODB_LIFE_LOG_URI environment variable");
}

declare global {
  var _lifeLogMongooseConn:
    | {
        conn: Connection | null;
        promise: Promise<Connection> | null;
      }
    | undefined;
}

const cached = global._lifeLogMongooseConn ?? { conn: null, promise: null };
global._lifeLogMongooseConn = cached;

async function connectLifeLogDb(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(uri!, { dbName: "lifelog" })
      .asPromise()
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function getLifeLogModels(): Promise<{
  Category: Model<LifeLogCategory>;
  Entry: Model<LifeLogEntry>;
}> {
  const conn = await connectLifeLogDb();

  const CategoryModel =
    (conn.models.LifeLogCategory as Model<LifeLogCategory> | undefined) ??
    conn.model<LifeLogCategory>("LifeLogCategory", CategorySchema);

  const EntryModel =
    (conn.models.LifeLogEntry as Model<LifeLogEntry> | undefined) ??
    conn.model<LifeLogEntry>("LifeLogEntry", EntrySchema);

  return { Category: CategoryModel, Entry: EntryModel };
}
