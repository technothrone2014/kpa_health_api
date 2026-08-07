// scripts/migrate-roles.js
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

async function migrateRoles() {
  console.log('🔄 Migrating roles from SQL Server to PostgreSQL...');
  
  try {
    // Connect to SQL Server
    const sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');
    
    // Connect to PostgreSQL - USING CONNECTION STRING
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Get roles from SQL Server
    const rolesResult = await sqlPool.request().query(`
      SELECT Id, Name, NormalizedName 
      FROM Roles
    `);
    console.log(`📋 Found ${rolesResult.recordset.length} roles in SQL Server`);
    
    // First, ensure the Roles table exists in PostgreSQL with correct schema
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS "Roles" (
        "Id" INTEGER PRIMARY KEY,
        "Name" VARCHAR(256),
        "NormalizedName" VARCHAR(256)
      )
    `);
    console.log('✅ Ensured Roles table exists in PostgreSQL');
    
    // Migrate each role
    let inserted = 0;
    let updated = 0;
    
    for (const role of rolesResult.recordset) {
      // Check if role already exists
      const existingRole = await pgClient.query(
        'SELECT "Id" FROM "Roles" WHERE "Id" = $1',
        [role.Id]
      );
      
      if (existingRole.rows.length === 0) {
        // Insert new role
        await pgClient.query(
          `INSERT INTO "Roles" ("Id", "Name", "NormalizedName")
           VALUES ($1, $2, $3)`,
          [role.Id, role.Name, role.NormalizedName]
        );
        inserted++;
        console.log(`✅ Inserted role: ${role.Name} (ID: ${role.Id})`);
      } else {
        // Update existing role
        await pgClient.query(
          `UPDATE "Roles" 
           SET "Name" = $2, "NormalizedName" = $3 
           WHERE "Id" = $1`,
          [role.Id, role.Name, role.NormalizedName]
        );
        updated++;
        console.log(`✅ Updated role: ${role.Name} (ID: ${role.Id})`);
      }
    }
    
    // Verify migration
    const verifyResult = await pgClient.query('SELECT * FROM "Roles" ORDER BY "Id"');
    console.log('\n📊 Migration Summary:');
    console.log(`   Total roles in PostgreSQL: ${verifyResult.rows.length}`);
    console.log(`   Inserted: ${inserted}, Updated: ${updated}`);
    
    await sqlPool.close();
    await pgClient.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Also migrate UserRoles if needed
async function migrateUserRoles() {
  console.log('\n🔄 Migrating UserRoles from SQL Server to PostgreSQL...');
  
  try {
    const sqlPool = await sql.connect(sqlConfig);
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    
    // Get UserRoles from SQL Server
    const userRolesResult = await sqlPool.request().query(`
      SELECT UserId, RoleId FROM UserRoles
    `);
    console.log(`📋 Found ${userRolesResult.recordset.length} user-role assignments in SQL Server`);
    
    // Ensure UserRoles table exists
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS "UserRoles" (
        "UserId" INTEGER NOT NULL,
        "RoleId" INTEGER NOT NULL,
        PRIMARY KEY ("UserId", "RoleId")
      )
    `);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const assignment of userRolesResult.recordset) {
      // Check if assignment already exists
      const existing = await pgClient.query(
        'SELECT 1 FROM "UserRoles" WHERE "UserId" = $1 AND "RoleId" = $2',
        [assignment.UserId, assignment.RoleId]
      );
      
      if (existing.rows.length === 0) {
        await pgClient.query(
          `INSERT INTO "UserRoles" ("UserId", "RoleId")
           VALUES ($1, $2)`,
          [assignment.UserId, assignment.RoleId]
        );
        inserted++;
      } else {
        skipped++;
      }
    }
    
    console.log(`✅ Migrated ${inserted} user-role assignments (${skipped} already existed)`);
    
    await sqlPool.close();
    await pgClient.end();
    
  } catch (error) {
    console.error('❌ UserRoles migration failed:', error);
  }
}

// Run migrations
async function main() {
  console.log('========================================');
  console.log('KPA Health - Role Migration');
  console.log('========================================\n');
  
  await migrateRoles();
  await migrateUserRoles();
  
  console.log('\n🎉 All migrations completed!');
}

main();