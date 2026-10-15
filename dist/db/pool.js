"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbSql = exports.poolPromise = void 0;
// kpa_health_api/src/db/pool.ts
const mssql_1 = __importDefault(require("mssql"));
exports.dbSql = mssql_1.default;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DB_TYPE = process.env.DB_TYPE || "sqlserver";
// Declare variables outside the conditional blocks
let poolPromise;
let dbSql = null;
// PostgreSQL connection
if (DB_TYPE === "postgresql") {
    // Get the DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("❌ DATABASE_URL environment variable is required for PostgreSQL connection");
        throw new Error("DATABASE_URL is required");
    }
    // Create a connection pool with explicit SSL configuration
    const pgPool = new pg_1.Pool({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false, // Accept self-signed certificates
        },
        // Increase connection timeout for Render
        connectionTimeoutMillis: 10000,
    });
    console.log("📌 Connecting to PostgreSQL with SSL enabled...");
    exports.poolPromise = poolPromise = pgPool
        .connect()
        .then((client) => {
        console.log("✅ Connected to PostgreSQL successfully!");
        return pgPool; // Return the pool, not the client
    })
        .catch((err) => {
        console.error("❌ PostgreSQL Connection Failed:", err.message);
        console.error("Connection string:", databaseUrl.replace(/:[^:@]*@/, ':****@'));
        throw err;
    });
    dbSql = null;
}
// SQL Server connection (for local development or KPA on-premise)
else {
    console.log("📌 Connecting to SQL Server...");
    const useTrustedConnection = process.env.DB_TRUSTED_CONNECTION === "true";
    // Validate required environment variables for SQL Server
    if (!process.env.DB_HOST) {
        console.error("❌ DB_HOST environment variable is required for SQL Server connection");
        throw new Error("DB_HOST is required");
    }
    if (!process.env.DB_NAME) {
        console.error("❌ DB_NAME environment variable is required for SQL Server connection");
        throw new Error("DB_NAME is required");
    }
    const dbConfig = {
        server: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 1433,
        database: process.env.DB_NAME,
        options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
        ...(useTrustedConnection
            ? {
                authentication: {
                    type: "ntlm",
                    options: {
                        userName: process.env.DB_USER || "",
                        password: process.env.DB_PASSWORD || "",
                        domain: process.env.DB_DOMAIN || "",
                    },
                },
            }
            : {
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD
            }),
    };
    exports.poolPromise = poolPromise = new mssql_1.default.ConnectionPool(dbConfig)
        .connect()
        .then((pool) => {
        console.log("✅ Connected to SQL Server successfully!");
        return pool;
    })
        .catch((err) => {
        console.error("❌ SQL Server Connection Failed:", err.message);
        throw err;
    });
    dbSql = mssql_1.default;
}
