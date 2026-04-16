// server.ts - API ONLY (For separate backend/frontend deployments)

import dotenv from "dotenv";
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
import { testEmailConnection } from './services/emailService.js';
import syncService from './services/syncService';
import dataCaptureRouter from './routes/dataCapture';
import usersRoutes from "./routes/users";

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS Configuration - Allow your frontend URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://kpa-health-ui.onrender.com',
  process.env.FRONTEND_URL,
].filter((origin): origin is string => !!origin);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'same-origin'}`);
  next();
});

// ============================================
// Health check
// ============================================
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API root info
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
      users: "/api/v1/users",
      sync: "/api/v1/sync",
      email: "/api/v1/email",
    },
    cors: {
      allowedOrigins,
      environment: process.env.NODE_ENV,
    },
    frontend: "https://kpa-health-ui.onrender.com",
  });
});

// ============================================
// ✅ ALL API ROUTES
// ============================================

// Auth routes
app.use("/api/v1/auth", authRouter);

// Employee routes
app.use("/api/v1/employees", employeesRouter);

// Analytics routes
app.use("/api/v1/analytics", analyticsRouter);

// Patients routes
app.use("/api/v1/patients", patientsRouter);

// Data correction routes
app.use("/api/data-correction", dataCorrectionRoutes);

// Users routes
app.use("/api/v1/users", usersRoutes);

// Data capture routes
app.use('/api/v1', dataCaptureRouter);

// Email test route
app.get('/api/v1/email/test', async (_req, res) => {
  const result = await testEmailConnection();
  res.json(result);
});

// Sync status route
app.get('/api/v1/sync/status', async (req, res) => {
  const status = await syncService.getSyncStatus();
  res.json(status);
});

// Manual sync route
app.post('/api/v1/sync/manual', async (req, res) => {
  const result = await syncService.manualSync();
  res.json(result);
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

// ============================================
// ❌ 404 handler - For API routes only
// ============================================
app.use((req: Request, res: Response) => {
  // Only handle API routes - anything else should 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.path}`,
    });
  }
  
  // For non-API routes, return a helpful message
  res.status(404).json({
    success: false,
    message: "This is the API server. Frontend routes should be accessed via the frontend URL.",
    frontend: "https://kpa-health-ui.onrender.com",
    apiDocs: "/",
  });
});

// Global error handler - MUST BE VERY LAST
app.use(errorHandler);

// Start server
const PORT: number = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 KPA Health API ready at http://0.0.0.0:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info(`Frontend URL: https://kpa-health-ui.onrender.com`);
  logger.info(`✅ API Routes registered:`);
  logger.info(`   - Auth: /api/v1/auth`);
  logger.info(`   - Employees: /api/v1/employees`);
  logger.info(`   - Analytics: /api/v1/analytics`);
  logger.info(`   - Patients: /api/v1/patients`);
  logger.info(`   - Data Correction: /api/data-correction`);
  logger.info(`   - Users: /api/v1/users`);
  logger.info(`   - Sync: /api/v1/sync`);
  logger.info(`   - Email: /api/v1/email`);
});

export default app;