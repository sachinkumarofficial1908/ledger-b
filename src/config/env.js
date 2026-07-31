const DEFAULT_PORT = 5000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPlaceholder(value) {
  return !value || /change_this|your_|replace_|example/i.test(value);
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  PORT: numberFromEnv(process.env.PORT, DEFAULT_PORT),
  MONGO_URI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS: numberFromEnv(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
  RATE_LIMIT_MAX_REQUESTS: numberFromEnv(process.env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  ILOVEPDF_PUBLIC_KEY: process.env.ILOVEPDF_PUBLIC_KEY,
  ILOVEPDF_SECRET_KEY: process.env.ILOVEPDF_SECRET_KEY,
});

export const usesHttpsOrigin = Boolean(
  env.CORS_ORIGIN?.split(",").some((origin) => origin.trim().startsWith("https://"))
);

export function validateEnv() {
  const required = ["MONGO_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SECRET", "CORS_ORIGIN"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.");
  }

  if (env.isProduction) {
    const weakSecrets = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "COOKIE_SECRET"].filter(
      (key) => isPlaceholder(process.env[key]) || process.env[key].length < 32
    );

    if (weakSecrets.length) {
      throw new Error(`Production secrets are missing or too weak: ${weakSecrets.join(", ")}`);
    }

    if (env.CORS_ORIGIN.includes("*")) {
      throw new Error("CORS_ORIGIN cannot contain wildcards in production.");
    }
  }
}
