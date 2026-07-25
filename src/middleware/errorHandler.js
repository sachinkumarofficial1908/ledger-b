import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, "Route not found."));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  const requestLabel = `${req.method} ${req.path || "/"}`;

  if (statusCode >= 500) {
    logger.error(`${requestLabel} -> ${err.message}`);
  } else {
    logger.debug(`${requestLabel} -> ${statusCode} ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: isApiError ? err.message : "Something went wrong. Please try again.",
    ...(isApiError && err.details ? { details: err.details } : {}),
  });
}
