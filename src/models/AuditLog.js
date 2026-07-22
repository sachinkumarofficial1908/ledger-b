import mongoose from "mongoose";

export const AUDIT_ACTIONS = [
  "TRANSACTION_CREATED",
  "TRANSACTION_UPDATED",
  "TRANSACTION_DELETED",
  "CLIENT_CREATED",
  "CLIENT_UPDATED",
  "CLIENT_DELETED",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
];

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, required: true }, // e.g. "Transaction", "Client", "User"
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ipAddress: { type: String, default: null },
  },
  { timestamps: { createdAt: "performedAt", updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ performedAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
