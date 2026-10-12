// scripts/migrate-remarks.js
// One-off migration: BPRemarks + RBSRemarks ONLY (Includes all rows for FK integrity)
const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

const sqlConfig = {
  user: process.env.KPA_DB_USER || 'api_user',
  password: process.env.KPA_DB_PASSWORD || 'Godlovesyou2!',
  server: process.env.KPA_DB_HOST || 'localhost',
  port: parseInt(process.env.KPA_SERVER_PORT || '1433'),
  database: process.env.KPA_DB_NAME || 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  }
};

const pgConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, require: true },
  connectionTimeoutMillis: 10000
};

async function migrateTable(sqlPool, pgClient, tableName) {
  console.log(`\n📦 Migrating: ${tableName}`);

  const schema = await sqlPool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION
  `);

  if (schema.recordset.length === 0) {
    console.log(`❌ No schema found for ${tableName}`);
    return;
  }

  const columns = schema.recordset.map(col => {
    let pgType = 'TEXT';
    switch (col.DATA_TYPE) {
      case 'int': pgType = 'INTEGER'; break;
      case 'bigint': pgType = 'BIGINT'; break;
      case 'varchar':
      case 'nvarchar':
        pgType = col.CHARACTER_MAXIMUM_LENGTH > 255
          ? 'TEXT'
          : `VARCHAR(${col.CHARACTER_MAXIMUM_LENGTH})`;
        break;
      case 'datetime':
      case 'datetime2': pgType = 'TIMESTAMP'; break;
      case 'bit': pgType = 'BOOLEAN'; break;
      case 'decimal': pgType = 'DECIMAL'; break;
      case 'float': pgType = 'FLOAT'; break;
      default: pgType = 'TEXT';
    }
    const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
    return `"${col.COLUMN_NAME}" ${pgType} ${nullable}`;
  }).join(',\n  ');

  await pgClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
  await pgClient.query(`CREATE TABLE "${tableName}" (\n  ${columns}\n)`);
  
  // Add Primary Key constraint so foreign keys can reference this table successfully
  await pgClient.query(`ALTER TABLE "${tableName}" ADD PRIMARY KEY ("Id")`);
  console.log(`✅ Table created with Primary Key: ${tableName}`);

  // Pull ALL rows (including deleted ones) to preserve 1:1 ID matching for foreign keys
  const data = await sqlPool.request().query(`SELECT * FROM ${tableName}`);
  console.log(`   Fetched ${data.recordset.length} total rows`);

  if (data.recordset.length === 0) return;

  const columnNames = schema.recordset.map(c => `"${c.COLUMN_NAME}"`).join(', ');
  const placeholders = schema.recordset.map((_, i) => `$${i + 1}`).join(', ');

  let inserted = 0;
  for (const row of data.recordset) {
    const values = schema.recordset.map(col => row[col.COLUMN_NAME]);
    try {
      await pgClient.query(
        `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`,
        values
      );
      inserted++;
    } catch (err) {
      console.error(`   Row insert error: ${err.message}`);
    }
  }
  console.log(`✅ Inserted ${inserted}/${data.recordset.length} rows`);
}

async function main() {
  console.log('🔄 Migrating BPRemarks + RBSRemarks (All Rows)\n');
  const sqlPool = await sql.connect(sqlConfig);
  console.log('✅ Connected to SQL Server');
  const pgClient = new Client(pgConfig);
  await pgClient.connect();
  console.log('✅ Connected to PostgreSQL\n');

  for (const table of ['BPRemarks', 'RBSRemarks']) {
    try {
      await migrateTable(sqlPool, pgClient, table);
    } catch (err) {
      console.error(`❌ Failed on ${table}:`, err.message);
    }
  }

  console.log('\n🎉 Done.');
  await sqlPool.close();
  await pgClient.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});