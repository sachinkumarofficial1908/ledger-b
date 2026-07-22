import AuditLog from "../models/AuditLog.js";
import { logger } from "./logger.js";

export async function recordAudit({
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  performedBy = null,
  ipAddress = null,
}) {
  try {
    await AuditLog.create({ action, entityType, entityId, oldValue, newValue, performedBy, ipAddress });
  } catch (err) {
    // Auditing must never break the main request — log and move on
    logger.error(`Failed to write audit log for ${action}: ${err.message}`);
  }
}
