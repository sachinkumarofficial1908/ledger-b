import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;

  // Expected client errors (not logged in yet, bad input, etc.) are normal
  // traffic, not incidents — logging them at "error" level buries real
  // problems in noise and makes a healthy server look like it's crashing.
  // Only 5xx (unexpected/unhandled) gets the loud log + full stack trace.
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.message}`, { stack: err.stack });
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${statusCode} ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: isApiError ? err.message : "Something went wrong. Please try again.",
    ...(isApiError && err.details ? { details: err.details } : {}),
  });
}
