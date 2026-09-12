import { Schema, models, model } from "mongoose";

// Atomically claims the "first admin" slot during registration so concurrent
// sign-ups can't all read userCount === 0 and each become admin.
const AdminLockSchema = new Schema({
  _id: { type: String },
  assignedAt: { type: Date, default: Date.now },
});

export default models.AdminLock ?? model("AdminLock", AdminLockSchema);
