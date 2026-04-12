const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

// SQL Server connection
const sqlConfig = {
  user: 'api_user2',
  password: 'Godlovesyou2!',
  server: 'DESKTOP-PU747QA',
  port: 1433,
  database: 'ZoodeskDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

// PostgreSQL connection
const pgConfig = {
  host: 'dpg-d77ri64hg0os73cfht70-a.oregon-postgres.render.com',
  port: 5432,
  database: 'eap_yyby',
  user: 'apiuser_2',
  password: 'MrwcwxhUENJ5s1fK1qLHeD1UsONoQvjE',
  ssl: { rejectUnauthorized: false, require: true }
};

async function migrateRoles() {
  console.log('🔄 Migrating roles from SQL Server to PostgreSQL...');
  
  try {
    // Connect to SQL Server
    const sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server');
    
    // Connect to PostgreSQL
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
        "Id" SERIAL PRIMARY KEY,
        "Name" VARCHAR(256),
        "NormalizedName" VARCHAR(256)
      )
    `);
    console.log('✅ Ensured Roles table exists in PostgreSQL');
    
    // Migrate each role
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
        console.log(`✅ Inserted role: ${role.Name} (ID: ${role.Id})`);
      } else {
        // Update existing role
        await pgClient.query(
          `UPDATE "Roles" 
           SET "Name" = $2, "NormalizedName" = $3 
           WHERE "Id" = $1`,
          [role.Id, role.Name, role.NormalizedName]
        );
        console.log(`✅ Updated role: ${role.Name} (ID: ${role.Id})`);
      }
    }
    
    // Verify migration
    const verifyResult = await pgClient.query('SELECT * FROM "Roles" ORDER BY "Id"');
    console.log('\n📊 Migration Summary:');
    console.log(`   Total roles in PostgreSQL: ${verifyResult.rows.length}`);
    console.log('\n📋 Roles migrated:');
    verifyResult.rows.forEach(role => {
      console.log(`   - ${role.Name} (ID: ${role.Id})`);
    });
    
    console.log('\n🎉 Roles migration completed successfully!');
    
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
