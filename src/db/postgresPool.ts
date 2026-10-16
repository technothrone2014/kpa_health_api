import { Pool } from 'pg';

export const createPostgresPool = (databaseUrl: string): Pool => {
  const sslMode = process.env.PGSSLMODE || 'verify-full';
  if (sslMode !== 'require' && sslMode !== 'verify-full') {
    throw new Error('PGSSLMODE must be either "require" or "verify-full"');
  }

  const connectionUrl = new URL(databaseUrl);
  connectionUrl.searchParams.set('sslmode', sslMode);

  return new Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: sslMode === 'verify-full' },
    connectionTimeoutMillis: 10000,
  });
};
