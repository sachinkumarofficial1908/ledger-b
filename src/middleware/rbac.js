import { ApiError } from "../utils/ApiError.js";

/**
 * Restricts a route to the given roles.
 * Usage: router.post("/", requireAuth, requireRole("super_admin"), handler)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, "Not authenticated."));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You don't have permission to do that."));
    }
    next();
  };
}

/**
 * For Admins, restricts access to only their assignedClients.
 * Super Admins bypass this check entirely.
 */
export function requireClientAccess(getClientId) {
  return (req, res, next) => {
    if (req.user.role === "super_admin") return next();

    const clientId = getClientId(req);
    const allowed = req.user.assignedClients?.some((id) => id.toString() === clientId);
    if (!allowed) {
      return next(new ApiError(403, "You don't have access to this client."));
    }
    next();
  };
}
