import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import compression from "compression";
import morgan from "morgan";

import { apiLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";
import { getAllowedOrigins, getCorsOriginHandler, getCookieSecret } from "./config/security.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";

const app = express();

// Trust the first proxy hop (needed for correct req.ip behind Nginx/Cloudflare/etc.)
app.set("trust proxy", 1);

// ---- Security middleware, in the recommended order ----
app.use(helmet());

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: getCorsOriginHandler(allowedOrigins),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser(getCookieSecret()));
app.use(mongoSanitize());
app.use(hpp());
app.use(apiLimiter);
app.use(compression());

app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "OK" });
});

// ---- Routes ----
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api", transactionRoutes); // exposes /api/clients/:id/transactions and /api/transactions/:id
app.use("/api/reports", reportRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);

// ---- 404 + error handling ----
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
