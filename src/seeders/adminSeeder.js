/**
 * Admin seeder
 * -------------
 * Creates the first Super Admin account from environment variables.
 * Safe to run multiple times — if a Super Admin already exists with
 * the given email, it will only update the name/role, never silently
 * overwrite an existing password.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Required env vars (see .env.example):
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import User from "../models/User.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MIN_PASSWORD_LENGTH = 8;

function validateEnv() {
  const required = ["MONGO_URI", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    logger.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (process.env.ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    logger.error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if (process.env.ADMIN_PASSWORD === "change_this_password") {
    logger.error("Refusing to seed with the placeholder ADMIN_PASSWORD. Set a real password in .env.");
    process.exit(1);
  }
}

async function confirmProductionRun() {
  if (process.env.NODE_ENV !== "production") return true;
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    'You are running the admin seeder against a PRODUCTION environment.\nType "yes" to continue: '
  );
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

async function run() {
  validateEnv();

  const proceed = await confirmProductionRun();
  if (!proceed) {
    logger.info("Aborted by operator.");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  logger.info("Connected to MongoDB for seeding.");

  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
  const name = process.env.ADMIN_NAME || "Super Admin";

  const existing = await User.findOne({ email });

  if (existing) {
    // Don't touch the password of an existing account — that would let
    // re-running this script silently reset credentials in production.
    existing.name = name;
    existing.role = "super_admin";
    existing.isActive = true;
    await existing.save();
    logger.info(`Existing Super Admin "${email}" updated (password left unchanged).`);
  } else {
    await User.create({
      name,
      email,
      password: process.env.ADMIN_PASSWORD, // hashed by the User model's pre-save hook
      role: "super_admin",
      isActive: true,
    });
    logger.info(`Super Admin "${email}" created.`);
  }

  await mongoose.disconnect();
  logger.info("Seeding complete. Remember to rotate ADMIN_PASSWORD after first login.");
  process.exit(0);
}

run().catch((err) => {
  logger.error(`Admin seeder failed: ${err.message}`);
  process.exit(1);
});
