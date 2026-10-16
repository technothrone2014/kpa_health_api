"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostgresPool = void 0;
const pg_1 = require("pg");
const createPostgresPool = (databaseUrl) => {
    const connectionUrl = new URL(databaseUrl);
    connectionUrl.searchParams.set('sslmode', 'verify-full');
    return new pg_1.Pool({
        connectionString: connectionUrl.toString(),
        ssl: { rejectUnauthorized: true },
        connectionTimeoutMillis: 10000,
    });
};
exports.createPostgresPool = createPostgresPool;
