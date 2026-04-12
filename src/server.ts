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
import patientsRouter from './routes/patients';
import authRouter from './routes/auth.js';
import { errorHandler } from "./middleware/errorHandler";
import logger from "./utils/logger";

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS Configuration - Allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',                          // Local development
  'https://kpa-health-ui.onrender.com',             // Production frontend
  process.env.FRONTEND_URL,                         // Custom frontend URL if set
].filter((origin): origin is string => !!origin);  // Remove undefined/null values

// CORS middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if the origin is allowed
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        // Still allow but log warning (or set to false to block)
        callback(null, true); // Change to false to block unlisted origins
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsers - IMPORTANT: These must come before route handlers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging with origin
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'same-origin'}`);
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
      auth: "/api/v1/auth",
      employees: "/api/v1/employees",
      dataCorrection: "/api/data-correction",
      analytics: "/api/v1/analytics",
      patients: "/api/v1/patients",
    },
    cors: {
      allowedOrigins,
      environment: process.env.NODE_ENV,
    },
  });
});

// API Routes - ORDER MATTERS! More specific routes first, then general
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/employees", employeesRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/patients", patientsRouter);
app.use("/api/data-correction", dataCorrectionRoutes);

// Test route for deployment verification
app.get("/api/test", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "API is working!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler - This should be LAST before error handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use(errorHandler);

// Convert PORT to number and ensure it's valid
const PORT: number = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server ready at http://0.0.0.0:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info(`✅ Auth routes registered at /api/v1/auth`);
});

export default app;
