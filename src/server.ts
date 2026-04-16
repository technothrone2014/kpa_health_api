// server.ts - WITH SPA FALLBACK (CommonJS Compatible)

import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import fs from "fs";
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

// ✅ CommonJS compatible __dirname equivalent
// This works regardless of module system
const __dirname = path.resolve();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://kpa-health-ui.onrender.com',
  process.env.FRONTEND_URL,
].filter((origin): origin is string => !!origin);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
// 🏠 SERVE REACT STATIC FILES (Production Only)
// ============================================
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Try multiple possible paths for the React build
  const possiblePaths = [
    path.join(__dirname, 'kpa_health_ui', 'dist'),
    path.join(__dirname, '..', 'kpa_health_ui', 'dist'),
    path.join(__dirname, '..', '..', 'kpa_health_ui', 'dist'),
    path.join(process.cwd(), 'kpa_health_ui', 'dist'),
    path.join(process.cwd(), '..', 'kpa_health_ui', 'dist'),
  ];
  
  // Find the first path that exists
  let clientBuildPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      clientBuildPath = p;
      logger.info(`Found React build at: ${clientBuildPath}`);
      break;
    }
  }
  
  if (clientBuildPath) {
    // Serve static assets (JS, CSS, images, etc.)
    app.use(express.static(clientBuildPath, {
      maxAge: '1y',
      immutable: true,
      index: false, // Don't serve index.html automatically yet
    }));
    
    logger.info('✅ React static files middleware configured');
  } else {
    logger.warn(`⚠️ React build directory not found. Checked paths:`);
    possiblePaths.forEach(p => logger.warn(`   - ${p}`));
  }
}

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
app.get("/api", (_req: Request, res: Response) => {
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
  });
});

// ============================================
// ✅ ALL API ROUTES - Must come BEFORE SPA fallback
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
// 🚨 SPA FALLBACK - Serve React app for all non-API routes
// ============================================
if (isProduction) {
  // Find the React build path again for the fallback
  const possiblePaths = [
    path.join(__dirname, 'kpa_health_ui', 'dist'),
    path.join(__dirname, '..', 'kpa_health_ui', 'dist'),
    path.join(__dirname, '..', '..', 'kpa_health_ui', 'dist'),
    path.join(process.cwd(), 'kpa_health_ui', 'dist'),
    path.join(process.cwd(), '..', 'kpa_health_ui', 'dist'),
  ];
  
  let clientBuildPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      clientBuildPath = p;
      break;
    }
  }
  
  const indexPath = clientBuildPath ? path.join(clientBuildPath, 'index.html') : '';
  
  // Catch-all route: Send all non-API requests to React's index.html
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes - they should have been handled above
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.method} ${req.path}`,
      });
    }
    
    // Skip static assets (they should have been handled by express.static)
    if (req.path.includes('.')) {
      return next();
    }
    
    // Serve the React app's index.html for all other routes
    if (indexPath && fs.existsSync(indexPath)) {
      logger.info(`SPA Fallback: Serving index.html for ${req.path}`);
      res.sendFile(indexPath);
    } else {
      logger.error(`React index.html not found. Checked: ${indexPath}`);
      res.status(500).json({
        success: false,
        message: 'Frontend application not found. Please ensure the React app is built.',
      });
    }
  });
} else {
  // Development fallback - useful for local development
  app.get('*', (req: Request, res: Response) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.method} ${req.path}`,
      });
    }
    
    // In development, just return a helpful message
    res.status(200).json({
      message: 'SPA fallback in development mode',
      path: req.path,
      note: 'In production, this would serve the React app. Make sure you\'re running the React dev server on port 5173.',
      frontendUrl: 'http://localhost:5173',
    });
  });
}

// Global error handler - MUST BE VERY LAST
app.use(errorHandler);

// Start server
const PORT: number = parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server ready at http://0.0.0.0:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info(`📁 Serving React app: ${isProduction ? 'YES' : 'NO (development mode)'}`);
  logger.info(`✅ Routes registered:`);
  logger.info(`   - Auth: /api/v1/auth`);
  logger.info(`   - Employees: /api/v1/employees`);
  logger.info(`   - Analytics: /api/v1/analytics`);
  logger.info(`   - Patients: /api/v1/patients`);
  logger.info(`   - Data Correction: /api/data-correction`);
  logger.info(`   - Users: /api/v1/users`);
  logger.info(`   - Sync: /api/v1/sync`);
  logger.info(`   - Email: /api/v1/email`);
  logger.info(`   - SPA Fallback: ${isProduction ? 'Enabled' : 'Development mode'}`);
});

export default app;