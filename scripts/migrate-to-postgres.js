// kpa_health_api/scripts/migrate-to-postgres.js
const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

// SQL Server connection (your local KPA-like DB)
const sqlConfig = {
  user: 'api_user2',  // Change this to your SQL Server username
  password: 'Godlovesyou2!',  // Change this to your SQL Server password
  server: 'localhost',
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

// PostgreSQL connection - USING YOUR EXTERNAL URL
const pgConfig = {
  host: 'dpg-d77ri64hg0os73cfht70-a.oregon-postgres.render.com',
  port: 5432,
  database: 'eap_yyby',
  user: 'apiuser_2',
  password: 'MrwcwxhUENJ5s1fK1qLHeD1UsONoQvjE', // Use the password from your URL
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
    
    // List of tables to migrate (from your SQL files)
    const tables = [
      'Categories', 'Genders', 'Stations', 'Clients', 'Tallies',
      'BPINTValues', 'BMIINTValues', 'RBSINTValues',
      'Findings', 'BMDINTValues', 'FBSINTValues', 'HBA1CINTValues',
      'Lipids', 'MicroalbuminINTValues', 'PSAINTValues',
      'HepatitisBValues', 'HepatitisCValues',
      'Oncologies', 'BreastExams', 'PAPSmears', 'ViaVillies'
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