// scripts/migrate-to-postgres.js
const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

// ============================================
// SQL SERVER CONFIGURATION
// ============================================
const sqlConfig = {
  user: process.env.KPA_DB_USER || 'api_user',
  password: process.env.KPA_DB_PASSWORD || 'Godlovesyou2!',
  server: process.env.KPA_DB_HOST || 'DESKTOP-5PSVOHG',
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

// ============================================
// POSTGRESQL (NEON) - USING CONNECTION STRING
// ============================================
const pgConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wLE5S2PIzdqx@ep-lively-fog-axbzki4d-pooler.c-4.us-east-2.aws.neon.tech/neondb',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 10000
};

async function migrateTable(sqlPool, pgClient, tableName) {
  console.log(`\n📦 Processing table: ${tableName}`);
  
  try {
    // Check if table exists in SQL Server
    const checkTable = await sqlPool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = '${tableName}'
    `);
    
    if (checkTable.recordset[0].count === 0) {
      console.log(`⚠️ Table ${tableName} not found, skipping...`);
      return;
    }
    
    // Get table schema
    const schema = await sqlPool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `);
    
    if (schema.recordset.length === 0) {
      console.log(`⚠️ No columns found for ${tableName}`);
      return;
    }
    
    // Build CREATE TABLE query for PostgreSQL
    const columns = schema.recordset.map(col => {
      let pgType = 'TEXT';
      switch (col.DATA_TYPE) {
        case 'int': pgType = 'INTEGER'; break;
        case 'bigint': pgType = 'BIGINT'; break;
        case 'varchar': 
        case 'nvarchar': 
          pgType = col.CHARACTER_MAXIMUM_LENGTH > 255 ? 'TEXT' : `VARCHAR(${col.CHARACTER_MAXIMUM_LENGTH})`;
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
    
    // Drop and recreate table in PostgreSQL
    await pgClient.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await pgClient.query(`CREATE TABLE "${tableName}" (${columns})`);
    console.log(`✅ Created table structure for ${tableName}`);
    
    // Get data from SQL Server
    const data = await sqlPool.request().query(`SELECT * FROM ${tableName} WHERE Deleted = 0`);
    
    if (data.recordset.length === 0) {
      console.log(`⚠️ No data in ${tableName}`);
      return;
    }
    
    // Insert data into PostgreSQL
    const columnNames = schema.recordset.map(col => `"${col.COLUMN_NAME}"`).join(', ');
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
        // Silently skip duplicate errors
        if (!err.message.includes('duplicate key')) {
          console.error(`Error inserting row:`, err.message);
        }
      }
    }
    
    console.log(`✅ Migrated ${inserted}/${data.recordset.length} records from ${tableName}`);
    
  } catch (err) {
    console.error(`❌ Error migrating ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('🔄 Starting migration from SQL Server to PostgreSQL...\n');
  
  try {
    // Connect to SQL Server
    const sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server\n');
    
    // Connect to PostgreSQL
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL\n');
    
    // List of tables to migrate
    const tables = [
      'Categories', 'Genders', 'Stations', 'Clients', 'Tallies', 'Findings', 'Oncologies',
      'Lipids', 'HepatitisBValues', 'HepatitisCValues','BreastExams', 'PAPSmears', 'ViaVillies',
      'BPINTValues', 'BMIINTValues', 'RBSINTValues', 'BMDINTValues', 'FBSINTValues', 'HBA1CINTValues',
      'PSAINTValues', 'MicroalbuminINTValues',
    ];
    
    for (const table of tables) {
      await migrateTable(sqlPool, pgClient, table);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
    await sqlPool.close();
    await pgClient.end();
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  }
}

// Run migration
main();