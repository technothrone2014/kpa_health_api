"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostgresPool = void 0;
const pg_1 = require("pg");
const createPostgresPool = (databaseUrl) => {
    const sslMode = process.env.PGSSLMODE || 'verify-full';
    if (sslMode !== 'require' && sslMode !== 'verify-full') {
        throw new Error('PGSSLMODE must be either "require" or "verify-full"');
    }
    const connectionUrl = new URL(databaseUrl);
    connectionUrl.searchParams.set('sslmode', sslMode);
    return new pg_1.Pool({
        connectionString: connectionUrl.toString(),
        ssl: { rejectUnauthorized: sslMode === 'verify-full' },
        connectionTimeoutMillis: 10000,
    });
};
exports.createPostgresPool = createPostgresPool;
