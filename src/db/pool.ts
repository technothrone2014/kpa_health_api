import sql from "mssql";
import dotenv from "dotenv";
import type { config } from "mssql";

dotenv.config();

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

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log("✅ Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("❌ Database Connection Failed:", err);
    throw err;
  });

export { poolPromise, sql };
