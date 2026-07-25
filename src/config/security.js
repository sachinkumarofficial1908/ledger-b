import { logger } from "../utils/logger.js";

export function getAllowedOrigins(rawOrigins = process.env.CORS_ORIGIN) {
  if (!rawOrigins) return [];

  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsOriginHandler(allowedOrigins = getAllowedOrigins()) {
  const allowedSet = new Set(allowedOrigins);

  return function corsOrigin(origin, callback) {
    if (!origin || allowedSet.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  };
}

export function getCookieOptions({ isProd = process.env.NODE_ENV === "production", path = "/", maxAge }) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path,
    maxAge,
  };
}

export function getCookieSecret() {
  const secret = process.env.COOKIE_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("COOKIE_SECRET or JWT_ACCESS_SECRET must be set in production.");
    }
    logger.warn("COOKIE_SECRET is not set. Falling back to a development-only secret.");
    return "development-cookie-secret";
  }

  return secret;
}
