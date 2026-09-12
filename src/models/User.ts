import { Schema, models, model, type InferSchemaType } from "mongoose";

// Users currently live on the same Mongoose connection as accounting data
// (connectAccountingDb) since that's the only shared DB connection set up so far.
const UserSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof UserSchema>;

export default models.User ?? model("User", UserSchema);
