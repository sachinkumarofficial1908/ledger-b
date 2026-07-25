import { logger } from "../utils/logger.js";
import { env, usesHttpsOrigin } from "./env.js";

export function getAllowedOrigins(rawOrigins = env.CORS_ORIGIN) {
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

    callback(new Error("Request origin is not allowed by CORS"));
  };
}

export function getCookieOptions({ isProd = env.isProduction || usesHttpsOrigin, path = "/", maxAge }) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path,
    maxAge,
  };
}

export function getCookieSecret() {
  const secret = env.COOKIE_SECRET;
  if (!secret) {
    if (env.isProduction) {
      throw new Error("COOKIE_SECRET must be set in production.");
    }
    logger.warn("COOKIE_SECRET is not set. Falling back to a development-only secret.");
    return "development-cookie-secret";
  }

  return secret;
}
