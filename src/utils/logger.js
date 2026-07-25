import fs from "node:fs";
import winston from "winston";

const { combine, timestamp, printf } = winston.format;

fs.mkdirSync("logs", { recursive: true });

function sanitizeMessage(message) {
  return String(message ?? "")
    .replace(process.cwd(), "[app]")
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, "[path]")
    .replace(/(?:\/[A-Za-z0-9._-]+){2,}/g, "[path]");
}

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${sanitizeMessage(message)}`;
});

const transports = [
  new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  new winston.transports.File({ filename: "logs/combined.log" }),
];

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp(), logFormat),
  transports,
  exitOnError: false,
});

// Reminder for anyone extending this logger:
// NEVER log passwords, JWT tokens, database URIs, or API secrets.
