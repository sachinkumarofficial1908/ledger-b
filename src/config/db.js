import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error("MONGO_URI is not set in the environment");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
}
