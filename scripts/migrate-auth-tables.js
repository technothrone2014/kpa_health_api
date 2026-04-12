// kpa_health_api/scripts/migrate-auth-tables-direct.js
const sql = require('mssql');
const { Client } = require('pg');

// SQL Server connection (Direct hardcoded for testing)
const sqlConfig = {
  user: 'api_user2',
  password: 'Godlovesyou2!',
  server: 'DESKTOP-PU747QA',  // Your computer name
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

// PostgreSQL connection (Render)
const pgConfig = {
  host: 'dpg-d77ri64hg0os73cfht70-a.oregon-postgres.render.com',
  port: 5432,
  database: 'eap_yyby',
  user: 'apiuser_2',
  password: 'MrwcwxhUENJ5s1fK1qLHeD1UsONoQvjE',
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
    const result = await pgClient.query('SELECT COUNT(*) FROM "Users"');
    console.log(`✅ PostgreSQL connected. Users count: ${result.rows[0].count}`);
    await pgClient.end();
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    return false;
  }
  
  return true;
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
    
    // Check existing users in PostgreSQL
    const existingUsers = await pgClient.query('SELECT COUNT(*) FROM "Users"');
    console.log(`📊 PostgreSQL currently has ${existingUsers.rows[0].count} users`);
    
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
    
    // Get data from SQL Server
    const data = await sqlPool.request().query('SELECT * FROM Users');
    
    if (data.recordset.length === 0) {
      console.log('⚠️ No users found to migrate');
      return;
    }
    
    // Insert each user
    let inserted = 0;
    let errors = 0;
    
    for (const row of data.recordset) {
      const columns = schema.recordset.map(col => `"${col.COLUMN_NAME}"`).join(', ');
      const placeholders = schema.recordset.map((_, i) => `$${i + 1}`).join(', ');
      const values = schema.recordset.map(col => {
        let val = row[col.COLUMN_NAME];
        // Convert bit to boolean
        if (col.DATA_TYPE === 'bit') {
          val = val === true || val === 1;
        }
        return val;
      });
      
      try {
        await pgClient.query(
          `INSERT INTO "Users" (${columns}) VALUES (${placeholders})
           ON CONFLICT ("Id") DO UPDATE SET
             "FirstName" = EXCLUDED."FirstName",
             "LastName" = EXCLUDED."LastName",
             "Email" = EXCLUDED."Email",
             "PhoneNumber" = EXCLUDED."PhoneNumber",
             "UpdatedAt" = CURRENT_TIMESTAMP`,
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