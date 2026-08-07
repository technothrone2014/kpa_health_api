// scripts/debug-users-schema.js
const sql = require('mssql');
require('dotenv').config();

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
  }
};

async function debugSchema() {
  try {
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server\n');
    
    // Get Users schema
    const schema = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Users Table Columns:');
    console.log('─'.repeat(60));
    schema.recordset.forEach((col, index) => {
      console.log(`${index + 1}. "${col.COLUMN_NAME}" (${col.DATA_TYPE})`);
    });
    
    // Also check for any problematic column names
    console.log('\n🔍 Checking for problematic column names:');
    schema.recordset.forEach(col => {
      if (col.COLUMN_NAME.includes('-') || col.COLUMN_NAME.includes(' ') || col.COLUMN_NAME.includes('/')) {
        console.log(`⚠️ Column "${col.COLUMN_NAME}" contains special characters`);
      }
    });
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

debugSchema();