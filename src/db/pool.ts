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
  const pgConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  };

  const pgPool = new PgPool(pgConfig);

  poolPromise = pgPool
    .connect()
    .then((pool) => {
      console.log("✅ Connected to PostgreSQL");
      return pool;
    })
    .catch((err) => {
      console.error("❌ PostgreSQL Connection Failed:", err);
      throw err;
    });
  
  // For PostgreSQL, we don't use mssql, so set to null
  dbSql = null;
} 
// SQL Server connection (for local development or KPA on-premise)
else {
  const useTrustedConnection = process.env.DB_TRUSTED_CONNECTION === "true";

  const dbConfig: config = {
    server: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT) || 1433,
    database: process.env.DB_NAME!,
    options: { encrypt: false, trustServerCertificate: true },
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
      : { user: process.env.DB_USER, password: process.env.DB_PASSWORD }),
  };

  poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
      console.log("✅ Connected to SQL Server");
      return pool;
    })
    .catch((err) => {
      console.error("❌ Database Connection Failed:", err);
      throw err;
    });
  
  dbSql = sql;
}

// Export at the top level (outside conditionals)
export { poolPromise, sql as dbSql };