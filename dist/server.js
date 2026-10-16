"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const emailService_js_1 = require("./services/emailService.js");
const whatsappService_js_1 = require("./services/whatsappService.js");
const errorHandler_1 = require("./middleware/errorHandler");
const authMiddleware_1 = require("./middleware/authMiddleware");
const logger_1 = __importDefault(require("./utils/logger"));
const dataCorrection_1 = __importDefault(require("./routes/dataCorrection"));
const dataCapture_1 = __importDefault(require("./routes/dataCapture"));
const employees_1 = __importDefault(require("./routes/employees"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const whatsapp_js_1 = __importDefault(require("./routes/whatsapp.js"));
const patients_1 = __importDefault(require("./routes/patients"));
const users_1 = __importDefault(require("./routes/users"));
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const app = (0, express_1.default)();
// ============================================
// 🛡️ MIDDLEWARE
// ============================================
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
// CORS Configuration - Allow your frontend URL
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://kpa-health-ui.onrender.com',
    process.env.FRONTEND_URL,
].filter((origin) => !!origin);
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error(`CORS not allowed for origin: ${origin}`));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
// Body parsers
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Request logging
app.use((req, res, next) => {
    logger_1.default.info(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'same-origin'}`);
    next();
});
// ============================================
// 🏥 HEALTH CHECK
// ============================================
app.get("/health", (_req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "PostgreSQL (Neon)",
    });
});
// ============================================
// 📋 API ROOT INFO
// ============================================
app.get("/", (_req, res) => {
    res.json({
        name: "KPA Health Intelligence API",
        version: "2.0.0",
        status: "running",
        database: "PostgreSQL (Neon)",
        endpoints: {
            auth: "/api/v1/auth",
            employees: "/api/v1/employees",
            dataCorrection: "/api/data-correction",
            analytics: "/api/v1/analytics",
            patients: "/api/v1/patients",
            users: "/api/v1/users",
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
app.use('/api/v1/whatsapp', whatsapp_js_1.default);
// Auth routes
app.use("/api/v1/auth", auth_js_1.default);
// Employee routes
app.use("/api/v1/employees", employees_1.default);
// Analytics routes
app.use("/api/v1/analytics", analytics_1.default);
// Patients routes
app.use("/api/v1/patients", patients_1.default);
// Data correction routes
app.use("/api/data-correction", dataCorrection_1.default);
// Users routes
app.use("/api/v1/users", users_1.default);
// Data capture routes
app.use('/api/v1', dataCapture_1.default);
// Email test route
app.get('/api/v1/email/test', authMiddleware_1.authMiddleware, authMiddleware_1.adminMiddleware, async (_req, res) => {
    const result = await (0, emailService_js_1.testEmailConnection)();
    res.json(result);
});
// Test route for deployment verification
app.get("/api/test", (_req, res) => {
    res.json({
        success: true,
        message: "API is working!",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: "PostgreSQL (Neon)",
    });
});
// ============================================
// ❌ 404 HANDLER
// ============================================
app.use((req, res) => {
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
app.use(errorHandler_1.errorHandler);
// ============================================
// 🚀 START SERVER
// ============================================
const PORT = parseInt(process.env.PORT || "8080", 10);
app.listen(PORT, '0.0.0.0', () => {
    logger_1.default.info(`🚀 KPA Health API ready at http://0.0.0.0:${PORT}`);
    logger_1.default.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger_1.default.info(`Database: PostgreSQL (Neon)`);
    logger_1.default.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
    logger_1.default.info(`Frontend URL: https://kpa-health-ui.onrender.com`);
    logger_1.default.info(`✅ API Routes registered:`);
    logger_1.default.info(`   - Auth: /api/v1/auth`);
    logger_1.default.info(`   - Employees: /api/v1/employees`);
    logger_1.default.info(`   - Analytics: /api/v1/analytics`);
    logger_1.default.info(`   - Patients: /api/v1/patients`);
    logger_1.default.info(`   - Data Correction: /api/data-correction`);
    logger_1.default.info(`   - Users: /api/v1/users`);
    logger_1.default.info(`   - Email: /api/v1/email`);
});
(0, whatsappService_js_1.initWhatsApp)().catch((err) => {
    console.error('WhatsApp init failed:', err.message);
    console.warn('Email OTP will still work as fallback.');
});
exports.default = app;
