// kpa_health_api/src/db/pool.ts
import sql from "mssql";
import { Pool as PgPool } from "pg";
import dotenv from "dotenv";
import type { config } from "mssql";

dotenv.config();

const DB_TYPE = process.env.DB_TYPE || "sqlserver";

// Declare variables outside the conditional blocks
let poolPromise: Promise<any>;
let dbSql: typeof sql | null = null;

// PostgreSQL connection
if (DB_TYPE === "postgresql") {
  // Get the DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required for PostgreSQL connection");
    throw new Error("DATABASE_URL is required");
  }
  
  // Create a connection pool with explicit SSL configuration
  const pgPool = new PgPool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false, // Accept self-signed certificates
    },
    // Increase connection timeout for Render
    connectionTimeoutMillis: 10000,
  });

  console.log("📌 Connecting to PostgreSQL with SSL enabled...");
  
  poolPromise = pgPool
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

  const dbConfig: config = {
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

  poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
      console.log("✅ Connected to SQL Server successfully!");
      return pool;
    })
    .catch((err) => {
      console.error("❌ SQL Server Connection Failed:", err.message);
      throw err;
    });
  
  dbSql = sql;
}

// Export at the top level
export { poolPromise, sql as dbSql };