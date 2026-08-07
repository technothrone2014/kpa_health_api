// scripts/migrate-all.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('KPA Health - Complete Database Migration');
console.log('========================================\n');

// Check if we're on Render
const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

console.log(`📍 Environment: ${isRender ? 'Render (Production)' : 'Local Development'}`);
console.log(`📌 SQL Server: ${process.env.KPA_DB_HOST || 'localhost'}`);
console.log(`📌 PostgreSQL: ${process.env.DB_HOST || 'neon-db'}\n`);

// Function to run a migration script
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 Running: ${path.basename(scriptPath)}`);
    console.log('─'.repeat(50));
    
    // FIX: Properly quote the script path to handle spaces
    const command = `node "${scriptPath}"`;
    
    const child = exec(command, {
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Pass connection details as environment variables
        SQL_SERVER: process.env.KPA_DB_HOST || 'localhost',
        SQL_DATABASE: process.env.KPA_DB_NAME || 'ZoodeskDB',
        SQL_USER: process.env.KPA_DB_USER || 'api_user',
        SQL_PASSWORD: process.env.KPA_DB_PASSWORD || 'Godlovesyou2!',
        PG_HOST: process.env.PG_HOST || 'localhost',
        PG_DATABASE: process.env.PG_DATABASE || 'kpa_health',
        PG_USER: process.env.PG_USER || 'postgres',
        PG_PASSWORD: process.env.PG_PASSWORD || '',
        PG_SSL: process.env.PG_SSL || 'false'
      }
    });

    child.stdout.on('data', (data) => {
      console.log(data);
    });

    child.stderr.on('data', (data) => {
      console.error(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${path.basename(scriptPath)} completed successfully`);
        resolve();
      } else {
        reject(new Error(`Migration script exited with code ${code}`));
      }
    });
  });
}

// Main migration function
async function runAllMigrations() {
  try {
    // Create updated versions of the scripts that read from environment
    console.log('📝 Preparing migration scripts...');
    
    // Migrate in order
    const scripts = [
      path.join(__dirname, 'migrate-roles.js'),
      path.join(__dirname, 'migrate-auth-tables.js'),
      path.join(__dirname, 'migrate-to-postgres.js')
    ];
    
    for (const script of scripts) {
      if (fs.existsSync(script)) {
        await runScript(script);
      } else {
        console.log(`⚠️ Script not found: ${script}`);
      }
    }
    
    console.log('\n🎉 All migrations completed successfully!');
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migrations
runAllMigrations();