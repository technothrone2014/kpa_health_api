// scripts/test-connections.js
const sql = require('mssql');
const { Client } = require('pg');

// Option 1: Try Windows Authentication first
const sqlConfigWindows = {
  server: 'DESKTOP-PU747QA',
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  authentication: {
    type: 'ntlm',
    options: {
      domain: '',  // Leave empty for local machine
      userName: '',  // Empty for current Windows user
      password: ''
    }
  }
};

// Option 2: Try SA account (default SQL Server admin)
const sqlConfigSA = {
  user: 'sa',
  password: '',  // Your SA password - try empty or common passwords
  server: 'localhost',
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Option 3: Your original config
const sqlConfigOriginal = {
  user: 'api_user2',
  password: 'Godlovesyou2!',
  server: 'localhost',
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function testConnections() {
  console.log('🔍 Testing SQL Server connections...\n');
  
  // Try Windows Authentication
  console.log('📌 Trying Windows Authentication...');
  try {
    const pool = await sql.connect(sqlConfigWindows);
    console.log('✅ Windows Authentication successful!');
    const result = await pool.request().query('SELECT SYSTEM_USER as current_user, DB_NAME() as database_name');
    console.log(`   Current User: ${result.recordset[0].current_user}`);
    console.log(`   Database: ${result.recordset[0].database_name}`);
    await pool.close();
    return;
  } catch (err) {
    console.log(`   ❌ Windows Auth failed: ${err.message}`);
  }
  
  // Try SA account
  console.log('\n📌 Trying SA account...');
  const commonPasswords = ['', 'password', 'sa', 'admin', 'Godlovesyou2!'];
  for (const pwd of commonPasswords) {
    try {
      sqlConfigSA.password = pwd;
      const pool = await sql.connect(sqlConfigSA);
      console.log(`✅ SA login successful with password: "${pwd || '(empty)'}"`);
      const result = await pool.request().query('SELECT SYSTEM_USER as current_user, DB_NAME() as database_name');
      console.log(`   Current User: ${result.recordset[0].current_user}`);
      console.log(`   Database: ${result.recordset[0].database_name}`);
      await pool.close();
      return;
    } catch (err) {
      // Continue trying
    }
  }
  console.log('   ❌ SA login failed with common passwords');
  
  // Try your original config
  console.log('\n📌 Trying api_user2...');
  try {
    const pool = await sql.connect(sqlConfigOriginal);
    console.log('✅ api_user2 login successful!');
    await pool.close();
    return;
  } catch (err) {
    console.log(`   ❌ api_user2 login failed: ${err.message}`);
  }
  
  console.log('\n💡 TROUBLESHOOTING TIPS:');
  console.log('1. Open SSMS as Administrator');
  console.log('2. Connect with Windows Authentication');
  console.log('3. Run these commands to create the user:');
  console.log(`
    -- Create login
    CREATE LOGIN api_user2 WITH PASSWORD = 'Godlovesyou2!';
    
    -- Create user in database
    USE ZoodeskDB;
    CREATE USER api_user2 FOR LOGIN api_user2;
    
    -- Grant permissions
    ALTER ROLE db_owner ADD MEMBER api_user2;
  `);
}

testConnections();