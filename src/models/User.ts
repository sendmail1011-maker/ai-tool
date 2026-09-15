import { Schema, models, model, type InferSchemaType } from "mongoose";

// Users currently live on the same Mongoose connection as accounting data
// (connectAccountingDb) since that's the only shared DB connection set up so far.
const UserSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    isAnonymous: { type: Boolean, default: false },
    // Devices (browsers) that can auto-log back into this account without a
    // password. An anonymous account with a password can be "claimed" from a
    // new device by supplying the matching name + password (see
    // /api/auth/anonymous), which adds that device's id here.
    deviceIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ deviceIds: 1 }, { unique: true, sparse: true });

export type User = InferSchemaType<typeof UserSchema>;

export default models.User ?? model("User", UserSchema);
