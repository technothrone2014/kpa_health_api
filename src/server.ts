// kpa_health_api/src/server.ts
import dotenv from "dotenv";
// Load env vars first
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import employeesRouter from "./routes/employees";
import dataCorrectionRoutes from "./routes/dataCorrection";
import analyticsRouter from "./routes/analytics";
import { errorHandler } from "./middleware/errorHandler";
import logger from "./utils/logger";

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "KPA Health Intelligence API",
    version: "2.0.0",
    status: "running",
    endpoints: {
      employees: "/api/v1/employees",
      dataCorrection: "/api/data-correction",
      analytics: "/api/v1/analytics",
    },
  });
});

// API Routes
app.use("/api/v1/employees", employeesRouter);
app.use("/api/data-correction", dataCorrectionRoutes);
app.use("/api/v1/analytics", analyticsRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Test route for deployment verification
app.get("/api/test", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`🚀 Server ready at http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
