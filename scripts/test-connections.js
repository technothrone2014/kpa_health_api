// scripts/test-connections.js
const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

console.log('========================================');
console.log('KPA Health - Database Connection Tests');
console.log('========================================\n');

// ============================================
// SQL SERVER CONFIGURATION (from .env)
// ============================================
const sqlConfig = {
  user: process.env.KPA_DB_USER || 'api_user',
  password: process.env.KPA_DB_PASSWORD || 'Godlovesyou2!',
  server: process.env.KPA_DB_HOST || 'DESKTOP-5PSVOHG',
  port: parseInt(process.env.KPA_SERVER_PORT || '1433'),
  database: process.env.KPA_DB_NAME || 'ZoodeskDB',
  options: {
    encrypt: process.env.KPA_ENCRYPT === 'true' || false,
    trustServerCertificate: process.env.KPA_TRUST_CERT === 'true' || true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  }
};

console.log('📌 SQL Server Configuration:');
console.log(`   Server: ${sqlConfig.server}:${sqlConfig.port}`);
console.log(`   Database: ${sqlConfig.database}`);
console.log(`   User: ${sqlConfig.user}`);
console.log(`   Auth: SQL Authentication\n`);

// ============================================
// POSTGRESQL (NEON) CONFIGURATION (from .env)
// ============================================
// Using the DATABASE_URL approach for Neon
const pgConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_wLE5S2PIzdqx@ep-lively-fog-axbzki4d-pooler.c-4.us-east-2.aws.neon.tech/neondb',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 10000,
  // Explicitly set these to ensure they're passed correctly
  host: process.env.PG_HOST || 'ep-lively-fog-axbzki4d-pooler.c-4.us-east-2.aws.neon.tech',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'neondb',
  user: process.env.PG_USER || 'neondb_owner',
  password: process.env.PG_PASSWORD || 'npg_wLE5S2PIzdqx',
};

console.log('📌 PostgreSQL Configuration:');
console.log(`   Host: ${pgConfig.host}:${pgConfig.port}`);
console.log(`   Database: ${pgConfig.database}`);
console.log(`   User: ${pgConfig.user}`);
console.log(`   Using SSL: Yes\n`);

// ============================================
// TEST FUNCTIONS
// ============================================

async function testSQLServer() {
  console.log('📌 Test 1: SQL Server (Local)');
  console.log('─'.repeat(50));
  
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('   ✅ Connected successfully!');
    
    const result = await pool.request()
      .query("SELECT SUSER_SNAME() AS CurrentUser, DB_NAME() AS DatabaseName, @@VERSION AS Version");
    
    console.log(`   👤 Current User: ${result.recordset[0].CurrentUser}`);
    console.log(`   📊 Database: ${result.recordset[0].DatabaseName}`);
    console.log(`   💾 Version: ${result.recordset[0].Version.split('\n')[0]}`);
    
    // Check table count
    const tables = await pool.request()
      .query("SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    
    console.log(`   📋 Tables: ${tables.recordset[0].TableCount} tables found`);
    
    if (tables.recordset[0].TableCount > 0) {
      const sampleTables = await pool.request()
        .query("SELECT TOP 5 TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
      
      console.log(`   📋 Sample tables:`);
      sampleTables.recordset.forEach((row, i) => {
        console.log(`      ${i + 1}. ${row.TABLE_NAME}`);
      });
    }
    
    await pool.close();
    console.log('   ✅ SQL Server test PASSED\n');
    return true;
  } catch (err) {
    console.log(`   ❌ Failed: ${err.message}`);
    console.log('   💡 Check SQL Server is running and credentials are correct\n');
    return false;
  }
}

async function testPostgreSQL() {
  console.log('📌 Test 2: PostgreSQL (Neon)');
  console.log('─'.repeat(50));
  
  // Try multiple connection methods
  const methods = [
    {
      name: 'Method 1: Connection String',
      config: {
        connectionString: pgConfig.connectionString,
        ssl: pgConfig.ssl,
        connectionTimeoutMillis: pgConfig.connectionTimeoutMillis
      }
    },
    {
      name: 'Method 2: Individual Parameters',
      config: {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
        password: pgConfig.password,
        ssl: pgConfig.ssl,
        connectionTimeoutMillis: pgConfig.connectionTimeoutMillis
      }
    },
    {
      name: 'Method 3: With SSL Mode',
      config: {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
        password: pgConfig.password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: pgConfig.connectionTimeoutMillis
      }
    }
  ];

  for (const method of methods) {
    try {
      console.log(`   Trying ${method.name}...`);
      const client = new Client(method.config);
      await client.connect();
      console.log('   ✅ Connected successfully!');
      
      const result = await client.query('SELECT NOW() as time, version() as version');
      console.log(`   🕐 Server Time: ${result.rows[0].time}`);
      console.log(`   💾 PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
      
      // Check existing tables
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log(`   📋 Tables found: ${tables.rows.length}`);
      if (tables.rows.length > 0) {
        const sampleTables = tables.rows.slice(0, 5).map(r => r.table_name).join(', ');
        console.log(`      Sample: ${sampleTables}${tables.rows.length > 5 ? '...' : ''}`);
      }
      
      await client.end();
      console.log('   ✅ PostgreSQL test PASSED\n');
      return true;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      // Continue to next method
    }
  }
  
  console.log('   ❌ All connection methods failed');
  console.log('   💡 Check Neon credentials in .env\n');
  return false;
}

// ============================================
// RUN TESTS
// ============================================

async function main() {
  // Test SQL Server
  const sqlSuccess = await testSQLServer();
  
  // Test PostgreSQL
  const pgSuccess = await testPostgreSQL();
  
  // Summary
  console.log('========================================');
  console.log('📋 TEST SUMMARY');
  console.log('========================================');
  console.log(`   SQL Server:  ${sqlSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   PostgreSQL:  ${pgSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (sqlSuccess && pgSuccess) {
    console.log('\n🎉 BOTH CONNECTIONS SUCCESSFUL!');
    console.log('📌 You can now run the migration:');
    console.log('   npm run migrate:db');
  } else if (sqlSuccess) {
    console.log('\n⚠️ SQL Server OK, but PostgreSQL failed.');
    console.log('📌 Check your Neon credentials in .env');
    console.log('   Make sure the password is correct and has no special characters');
  } else if (pgSuccess) {
    console.log('\n⚠️ PostgreSQL OK, but SQL Server failed.');
    console.log('📌 Check SQL Server is running and port 1433 is correct.');
  } else {
    console.log('\n❌ Both connections failed!');
    console.log('📌 Check network connectivity and credentials.');
  }
  console.log('========================================');
}

// Run the tests
main().catch(console.error);