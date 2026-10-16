import { Pool } from 'pg';

export const createPostgresPool = (databaseUrl: string): Pool => {
  const connectionUrl = new URL(databaseUrl);
  connectionUrl.searchParams.set('sslmode', 'verify-full');

  return new Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
};
