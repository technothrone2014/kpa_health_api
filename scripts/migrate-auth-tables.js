// scripts/migrate-auth-tables.js
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

async function testConnections() {
  console.log('🔍 Testing connections...\n');
  
  // Test SQL Server
  try {
    console.log('📌 Testing SQL Server connection...');
    const sqlPool = await sql.connect(sqlConfig);
    const result = await sqlPool.request().query('SELECT COUNT(*) as count FROM Users');
    console.log(`✅ SQL Server connected. Users count: ${result.recordset[0].count}`);
    await sqlPool.close();
  } catch (err) {
    console.error('❌ SQL Server connection failed:', err.message);
    return false;
  }
  
  // Test PostgreSQL
  try {
    console.log('\n📌 Testing PostgreSQL connection...');
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ PostgreSQL connected successfully!');
    
    const result = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Users'
      ) as exists
    `);
    
    if (result.rows[0].exists) {
      const count = await pgClient.query('SELECT COUNT(*) FROM "Users"');
      console.log(`📊 Users table exists with ${count.rows[0].count} records`);
    } else {
      console.log('📊 Users table does not exist yet (will be created during migration)');
    }
    
    await pgClient.end();
    console.log('✅ PostgreSQL test PASSED\n');
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    return false;
  }
}

async function migrateUsers() {
  console.log('\n🔄 Starting migration...\n');
  
  let sqlPool = null;
  let pgClient = null;
  
  try {
    // Connect to SQL Server
    console.log('📌 Connecting to SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');
    
    // Get users count
    const userCount = await sqlPool.request().query('SELECT COUNT(*) as count FROM Users');
    console.log(`📊 Found ${userCount.recordset[0].count} users in SQL Server`);
    
    // Connect to PostgreSQL
    console.log('\n📌 Connecting to PostgreSQL...');
    pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Get Users schema from SQL Server
    const schema = await sqlPool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log(`\n📋 Found ${schema.recordset.length} columns in Users table`);
    
    // Log all column names for debugging
    console.log('📝 Column names:');
    schema.recordset.forEach((col, i) => {
      console.log(`   ${i + 1}. "${col.COLUMN_NAME}" (${col.DATA_TYPE})`);
    });
    
    // Build CREATE TABLE query for PostgreSQL with proper type mapping
    const columnDefs = schema.recordset.map(col => {
      let pgType = 'TEXT';
      
      // Handle character types with MAX length (-1)
      const isMaxLength = col.CHARACTER_MAXIMUM_LENGTH === -1;
      
      switch (col.DATA_TYPE) {
        case 'int': pgType = 'INTEGER'; break;
        case 'bigint': pgType = 'BIGINT'; break;
        case 'bit': pgType = 'BOOLEAN'; break;
        case 'decimal': pgType = 'DECIMAL'; break;
        case 'float': pgType = 'FLOAT'; break;
        case 'datetime':
        case 'datetime2': pgType = 'TIMESTAMP'; break;
        case 'datetimeoffset': pgType = 'TIMESTAMPTZ'; break;
        case 'varchar': 
        case 'nvarchar': 
          // FIX: If max length is -1 (MAX) or > 255, use TEXT
          if (isMaxLength || col.CHARACTER_MAXIMUM_LENGTH > 255 || col.CHARACTER_MAXIMUM_LENGTH === null) {
            pgType = 'TEXT';
          } else {
            pgType = `VARCHAR(${col.CHARACTER_MAXIMUM_LENGTH})`;
          }
          break;
        default: pgType = 'TEXT';
      }
      
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      return `"${col.COLUMN_NAME}" ${pgType} ${nullable}`;
    });
    
    const createTableSQL = `CREATE TABLE "Users" (\n  ${columnDefs.join(',\n  ')}\n)`;
    
    // Log the CREATE TABLE statement for debugging
    console.log('\n📝 CREATE TABLE SQL:');
    console.log(createTableSQL);
    
    // Drop and recreate table in PostgreSQL
    await pgClient.query(`DROP TABLE IF EXISTS "Users"`);
    console.log('✅ Dropped existing Users table (if any)');
    
    await pgClient.query(createTableSQL);
    console.log('✅ Created Users table structure in PostgreSQL');
    
    // Get data from SQL Server
    console.log('\n📥 Fetching user data from SQL Server...');
    const data = await sqlPool.request().query('SELECT * FROM Users');
    
    if (data.recordset.length === 0) {
      console.log('⚠️ No users found to migrate');
      return;
    }
    
    console.log(`📊 Found ${data.recordset.length} users to migrate`);
    
    // Get column names for INSERT
    const columnNames = schema.recordset.map(col => `"${col.COLUMN_NAME}"`).join(', ');
    const placeholders = schema.recordset.map((_, i) => `$${i + 1}`).join(', ');
    
    let inserted = 0;
    let errors = 0;
    
    console.log('\n📤 Inserting users into PostgreSQL...');
    
    for (const row of data.recordset) {
      const values = schema.recordset.map(col => {
        let val = row[col.COLUMN_NAME];
        // Convert bit to boolean
        if (col.DATA_TYPE === 'bit') {
          val = val === true || val === 1;
        }
        // Handle datetimeoffset - convert to ISO string
        if (col.DATA_TYPE === 'datetimeoffset' && val) {
          val = new Date(val).toISOString();
        }
        return val;
      });
      
      try {
        await pgClient.query(
          `INSERT INTO "Users" (${columnNames}) VALUES (${placeholders})`,
          values
        );
        inserted++;
        if (inserted % 10 === 0) {
          console.log(`   Migrated ${inserted} users...`);
        }
      } catch (err) {
        errors++;
        console.error(`   Error inserting user ${row.Id}:`, err.message);
      }
    }
    
    console.log(`\n✅ Migration complete: ${inserted} users migrated, ${errors} errors`);
    
    // Verify final count
    const finalCount = await pgClient.query('SELECT COUNT(*) FROM "Users"');
    console.log(`📊 PostgreSQL now has ${finalCount.rows[0].count} users`);
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    if (sqlPool) await sqlPool.close();
    if (pgClient) await pgClient.end();
  }
}

async function main() {
  console.log('========================================');
  console.log('KPA Health - Auth Tables Migration');
  console.log('========================================\n');
  
  const connectionsOk = await testConnections();
  if (!connectionsOk) {
    console.log('\n❌ Cannot proceed with migration due to connection issues.');
    return;
  }
  
  await migrateUsers();
  
  console.log('\n🎉 Migration process completed!');
}

main();