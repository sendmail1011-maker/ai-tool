import mongoose, { type Connection, type Model } from "mongoose";
import { FitnessProfileSchema, type FitnessProfile } from "@/models/fitness/FitnessProfile";
import { WeightLogSchema, type WeightLog } from "@/models/fitness/WeightLog";
import { WorkoutPlanSchema, type WorkoutPlan } from "@/models/fitness/WorkoutPlan";
import { DietPlanSchema, type DietPlan } from "@/models/fitness/DietPlan";
import { MealLogSchema, type MealLog } from "@/models/fitness/MealLog";
import { WaterLogSchema, type WaterLog } from "@/models/fitness/WaterLog";
import { SleepLogSchema, type SleepLog } from "@/models/fitness/SleepLog";
import { CardioLogSchema, type CardioLog } from "@/models/fitness/CardioLog";
import { StepLogSchema, type StepLog } from "@/models/fitness/StepLog";

const uri = process.env.MONGODB_FITNESS_URI;

if (!uri) {
  throw new Error("Missing MONGODB_FITNESS_URI environment variable");
}

// Fitness data is kept on its own Mongoose connection (separate from the
// accounting app's default connection in @/lib/mongoose) so nothing here can
// ever touch the accounting database.
declare global {
  var _fitnessMongooseConn:
    | {
        conn: Connection | null;
        promise: Promise<Connection> | null;
      }
    | undefined;
}

const cached = global._fitnessMongooseConn ?? { conn: null, promise: null };
global._fitnessMongooseConn = cached;

async function connectFitnessDb(): Promise<Connection> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .createConnection(uri!, { dbName: "fitness" })
      .asPromise()
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function getFitnessModels(): Promise<{
  FitnessProfile: Model<FitnessProfile>;
  WeightLog: Model<WeightLog>;
  WorkoutPlan: Model<WorkoutPlan>;
  DietPlan: Model<DietPlan>;
  MealLog: Model<MealLog>;
  WaterLog: Model<WaterLog>;
  SleepLog: Model<SleepLog>;
  CardioLog: Model<CardioLog>;
  StepLog: Model<StepLog>;
}> {
  const conn = await connectFitnessDb();

  const FitnessProfileModel =
    (conn.models.FitnessProfile as Model<FitnessProfile> | undefined) ??
    conn.model<FitnessProfile>("FitnessProfile", FitnessProfileSchema);

  const WeightLogModel =
    (conn.models.WeightLog as Model<WeightLog> | undefined) ??
    conn.model<WeightLog>("WeightLog", WeightLogSchema);

  const WorkoutPlanModel =
    (conn.models.WorkoutPlan as Model<WorkoutPlan> | undefined) ??
    conn.model<WorkoutPlan>("WorkoutPlan", WorkoutPlanSchema);

  const DietPlanModel =
    (conn.models.DietPlan as Model<DietPlan> | undefined) ??
    conn.model<DietPlan>("DietPlan", DietPlanSchema);

  const MealLogModel =
    (conn.models.MealLog as Model<MealLog> | undefined) ??
    conn.model<MealLog>("MealLog", MealLogSchema);

  const WaterLogModel =
    (conn.models.WaterLog as Model<WaterLog> | undefined) ??
    conn.model<WaterLog>("WaterLog", WaterLogSchema);

  const SleepLogModel =
    (conn.models.SleepLog as Model<SleepLog> | undefined) ??
    conn.model<SleepLog>("SleepLog", SleepLogSchema);

  const CardioLogModel =
    (conn.models.CardioLog as Model<CardioLog> | undefined) ??
    conn.model<CardioLog>("CardioLog", CardioLogSchema);

  const StepLogModel =
    (conn.models.StepLog as Model<StepLog> | undefined) ??
    conn.model<StepLog>("StepLog", StepLogSchema);

  return {
    FitnessProfile: FitnessProfileModel,
    WeightLog: WeightLogModel,
    WorkoutPlan: WorkoutPlanModel,
    DietPlan: DietPlanModel,
    MealLog: MealLogModel,
    WaterLog: WaterLogModel,
    SleepLog: SleepLogModel,
    CardioLog: CardioLogModel,
    StepLog: StepLogModel,
  };
}
