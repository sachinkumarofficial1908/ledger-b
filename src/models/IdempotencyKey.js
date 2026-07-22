import mongoose from "mongoose";

const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  scope: { type: String, required: true }, // e.g. "create-transaction" — keys are scoped per operation
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  statusCode: { type: Number },
  responseBody: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: "26h" }, // TTL index: auto-cleans after 26h
});

idempotencyKeySchema.index({ key: 1, scope: 1 }, { unique: true });

export default mongoose.model("IdempotencyKey", idempotencyKeySchema);
