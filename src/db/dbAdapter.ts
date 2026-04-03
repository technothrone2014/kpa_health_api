// kpa_health_api/src/db/dbAdapter.ts
import sql, { ConnectionPool } from 'mssql';
import { Pool as PgPool } from 'pg';
import { poolPromise as sqlServerPool } from './pool';
import dotenv from 'dotenv';

dotenv.config();

// Detect which database we're using
const DB_TYPE = process.env.DB_TYPE || 'sqlserver'; // 'sqlserver' or 'postgresql'

class DatabaseAdapter {
  private pgPool: PgPool | null = null;
  private sqlPool: ConnectionPool | null = null;

  async connect() {
    if (DB_TYPE === 'postgresql') {
      this.pgPool = new PgPool({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      await this.pgPool.connect();
      console.log('✅ Connected to PostgreSQL');
    } else {
      // SQL Server connection - await the promise to get the actual pool
      this.sqlPool = await sqlServerPool;
      console.log('✅ Connected to SQL Server');
    }
  }

  async query(sqlQuery: string, params?: any[]) {
    if (DB_TYPE === 'postgresql') {
      // PostgreSQL query
      if (!this.pgPool) {
        throw new Error('PostgreSQL not connected. Call connect() first.');
      }
      const result = await this.pgPool.query(sqlQuery, params);
      return { recordset: result.rows };
    } else {
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
    } else if (this.sqlPool) {
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
    } else {
      if (!this.sqlPool) {
        throw new Error('SQL Server not connected. Call connect() first.');
      }
      return this.sqlPool;
    }
  }
}

export default new DatabaseAdapter();
