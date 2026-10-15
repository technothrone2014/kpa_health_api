"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const pool_1 = require("./pool");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Detect which database we're using
const DB_TYPE = process.env.DB_TYPE || 'sqlserver'; // 'sqlserver' or 'postgresql'
class DatabaseAdapter {
    constructor() {
        this.pgPool = null;
        this.sqlPool = null;
    }
    async connect() {
        if (DB_TYPE === 'postgresql') {
            // Use DATABASE_URL from environment (same as pool.ts)
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
            }
            this.pgPool = new pg_1.Pool({
                connectionString: databaseUrl,
                ssl: {
                    rejectUnauthorized: false, // Accept self-signed certificates for Render
                },
                connectionTimeoutMillis: 10000,
            });
            await this.pgPool.connect();
            console.log('✅ Connected to PostgreSQL via dbAdapter');
        }
        else {
            // SQL Server connection - await the promise to get the actual pool
            this.sqlPool = await pool_1.poolPromise;
            console.log('✅ Connected to SQL Server via dbAdapter');
        }
    }
    async query(sqlQuery, params) {
        if (DB_TYPE === 'postgresql') {
            // PostgreSQL query
            if (!this.pgPool) {
                throw new Error('PostgreSQL not connected. Call connect() first.');
            }
            const result = await this.pgPool.query(sqlQuery, params);
            return { recordset: result.rows };
        }
        else {
            // SQL Server query
            if (!this.sqlPool) {
                throw new Error('SQL Server not connected. Call connect() first.');
            }
            const request = this.sqlPool.request();
            if (params) {
                params.forEach((param, index) => {
                    request.input(`param${index}`, param);
                });
            }
            const result = await request.query(sqlQuery);
            return result;
        }
    }
    async disconnect() {
        if (DB_TYPE === 'postgresql' && this.pgPool) {
            await this.pgPool.end();
            console.log('🔒 Disconnected from PostgreSQL');
        }
        else if (this.sqlPool) {
            await this.sqlPool.close();
            console.log('🔒 Disconnected from SQL Server');
        }
    }
    // Helper method to get the raw pool for transactions
    async getConnection() {
        if (DB_TYPE === 'postgresql') {
            if (!this.pgPool) {
                throw new Error('PostgreSQL not connected. Call connect() first.');
            }
            return this.pgPool;
        }
        else {
            if (!this.sqlPool) {
                throw new Error('SQL Server not connected. Call connect() first.');
            }
            return this.sqlPool;
        }
    }
}
exports.default = new DatabaseAdapter();
