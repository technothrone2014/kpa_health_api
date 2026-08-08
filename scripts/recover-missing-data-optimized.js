// scripts/recover-missing-data-optimized.js
const sql = require('mssql');
const { Client } = require('pg');
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================
const BATCH_SIZE = 1000;
const PROGRESS_INTERVAL = 5000;

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
    requestTimeout: 600000,
  }
};

const pgConfig = {
  host: process.env.PG_HOST || 'ep-lively-fog-axbzki4d-pooler.c-4.us-east-2.aws.neon.tech',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'neondb',
  user: process.env.PG_USER || 'neondb_owner',
  password: process.env.PG_PASSWORD || 'npg_wLE5S2PIzdqx',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
};

// ============================================
// PROGRESS TRACKING
// ============================================
class ProgressTracker {
  constructor(tableName, totalRecords) {
    this.tableName = tableName;
    this.totalRecords = totalRecords;
    this.processedRecords = 0;
    this.startTime = Date.now();
    this.lastUpdate = Date.now();
    this.isComplete = false;
  }

  update(processed) {
    this.processedRecords = processed;
    const now = Date.now();
    if (now - this.lastUpdate >= PROGRESS_INTERVAL || this.isComplete) {
      this.displayProgress();
      this.lastUpdate = now;
    }
  }

  displayProgress() {
    const percentage = ((this.processedRecords / this.totalRecords) * 100).toFixed(1);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
    const rate = this.processedRecords / (Date.now() - this.startTime) * 1000;
    const remaining = this.totalRecords - this.processedRecords;
    const eta = remaining > 0 && rate > 0 ? (remaining / rate).toFixed(0) : '?';
    
    const barLength = 30;
    const filled = Math.floor((this.processedRecords / this.totalRecords) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    console.log(
      `\r📊 ${this.tableName}: [${bar}] ${percentage}% ` +
      `(${this.processedRecords.toLocaleString()}/${this.totalRecords.toLocaleString()}) ` +
      `⏱️ ${elapsed}s | ⚡ ${rate.toFixed(0)}/s | ⏳ ${eta}s remaining`
    );
  }

  complete() {
    this.isComplete = true;
    this.displayProgress();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`✅ ${this.tableName} completed in ${elapsed}s\n`);
  }
}

// ============================================
// GET COLUMNS FROM SQL SERVER
// ============================================
async function getSQLServerColumns(sqlPool, tableName) {
  const result = await sqlPool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION
  `);
  return result.recordset.map(r => r.COLUMN_NAME);
}

// ============================================
// DROP AND RECREATE FOREIGN KEYS
// ============================================
async function dropForeignKeys(pgClient) {
  console.log('📌 Dropping foreign key constraints...');
  
  // Get all foreign key constraints
  const result = await pgClient.query(`
    SELECT 
      tc.table_name,
      tc.constraint_name
    FROM 
      information_schema.table_constraints tc
    WHERE 
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('Clients', 'Tallies', 'Findings', 'Oncologies', 'UserRoles')
  `);
  
  for (const row of result.rows) {
    try {
      await pgClient.query(`ALTER TABLE "${row.table_name}" DROP CONSTRAINT "${row.constraint_name}"`);
      console.log(`   ✅ Dropped ${row.constraint_name} from ${row.table_name}`);
    } catch (err) {
      console.log(`   ⚠️ Could not drop ${row.constraint_name}: ${err.message}`);
    }
  }
}

async function recreateForeignKeys(pgClient) {
  console.log('📌 Recreating foreign key constraints...');
  
  // Recreate all foreign keys
  const constraints = [
    // Clients foreign keys
    { table: 'Clients', name: 'FK_Clients_Users', columns: 'UserId', ref: 'Users(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Clients', name: 'FK_Clients_Categories', columns: 'CategoryId', ref: 'Categories(Id)', onDelete: '' },
    { table: 'Clients', name: 'FK_Clients_Genders', columns: 'GenderId', ref: 'Genders(Id)', onDelete: '' },
    { table: 'Clients', name: 'FK_Clients_Stations', columns: 'StationId', ref: 'Stations(Id)', onDelete: '' },
    
    // Tallies foreign keys
    { table: 'Tallies', name: 'FK_Tallies_Users', columns: 'UserId', ref: 'Users(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Tallies', name: 'FK_Tallies_Clients', columns: 'ClientId', ref: 'Clients(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Tallies', name: 'FK_Tallies_Categories', columns: 'CategoryId', ref: 'Categories(Id)', onDelete: '' },
    { table: 'Tallies', name: 'FK_Tallies_Genders', columns: 'GenderId', ref: 'Genders(Id)', onDelete: '' },
    { table: 'Tallies', name: 'FK_Tallies_Stations', columns: 'StationId', ref: 'Stations(Id)', onDelete: '' },
    { table: 'Tallies', name: 'FK_Tallies_BMIINTValues', columns: 'BMIINTValueId', ref: 'BMIINTValues(Id)', onDelete: '' },
    { table: 'Tallies', name: 'FK_Tallies_BPINTValues', columns: 'BPINTValueId', ref: 'BPINTValues(Id)', onDelete: '' },
    { table: 'Tallies', name: 'FK_Tallies_RBSINTValues', columns: 'RBSINTValueId', ref: 'RBSINTValues(Id)', onDelete: '' },
    
    // Findings foreign keys
    { table: 'Findings', name: 'FK_Findings_Users', columns: 'UserId', ref: 'Users(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Findings', name: 'FK_Findings_Clients', columns: 'ClientId', ref: 'Clients(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Findings', name: 'FK_Findings_Categories', columns: 'CategoryId', ref: 'Categories(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_Genders', columns: 'GenderId', ref: 'Genders(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_Stations', columns: 'StationId', ref: 'Stations(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_MicroalbuminINTValues', columns: 'MicroalbuminINTValueId', ref: 'MicroalbuminINTValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_FBSINTValues', columns: 'FBSINTValueId', ref: 'FBSINTValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_HBA1CINTValues', columns: 'HBA1CINTValueId', ref: 'HBA1CINTValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_BMDINTValues', columns: 'BMDINTValueId', ref: 'BMDINTValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_PSAINTValues', columns: 'PSAINTValueId', ref: 'PSAINTValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_Lipids', columns: 'LipidId', ref: 'Lipids(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_HepatitisBValues', columns: 'HepatitisBValueId', ref: 'HepatitisBValues(Id)', onDelete: '' },
    { table: 'Findings', name: 'FK_Findings_HepatitisCValues', columns: 'HepatitisCValueId', ref: 'HepatitisCValues(Id)', onDelete: '' },
    
    // Oncologies foreign keys
    { table: 'Oncologies', name: 'FK_Oncologies_Users', columns: 'UserId', ref: 'Users(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Oncologies', name: 'FK_Oncologies_Clients', columns: 'ClientId', ref: 'Clients(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'Oncologies', name: 'FK_Oncologies_Categories', columns: 'CategoryId', ref: 'Categories(Id)', onDelete: '' },
    { table: 'Oncologies', name: 'FK_Oncologies_Genders', columns: 'GenderId', ref: 'Genders(Id)', onDelete: '' },
    { table: 'Oncologies', name: 'FK_Oncologies_Stations', columns: 'StationId', ref: 'Stations(Id)', onDelete: '' },
    { table: 'Oncologies', name: 'FK_Oncologies_BreastExams', columns: 'BreastExamId', ref: 'BreastExams(Id)', onDelete: '' },
    { table: 'Oncologies', name: 'FK_Oncologies_PAPSmears', columns: 'PAPSmearId', ref: 'PAPSmears(Id)', onDelete: '' },
    { table: 'Oncologies', name: 'FK_Oncologies_ViaVillies', columns: 'ViaVilliId', ref: 'ViaVillies(Id)', onDelete: '' },
    
    // UserRoles foreign keys
    { table: 'UserRoles', name: 'FK_UserRoles_Users_UserId', columns: 'UserId', ref: 'Users(Id)', onDelete: 'ON DELETE CASCADE' },
    { table: 'UserRoles', name: 'FK_UserRoles_Roles_RoleId', columns: 'RoleId', ref: 'Roles(Id)', onDelete: 'ON DELETE CASCADE' },
  ];
  
  for (const constraint of constraints) {
    try {
      const onDelete = constraint.onDelete ? ` ${constraint.onDelete}` : '';
      await pgClient.query(`
        ALTER TABLE "${constraint.table}" 
        ADD CONSTRAINT "${constraint.name}" 
        FOREIGN KEY (${constraint.columns}) 
        REFERENCES ${constraint.ref}${onDelete}
      `);
      console.log(`   ✅ Created ${constraint.name}`);
    } catch (err) {
      console.log(`   ⚠️ Could not create ${constraint.name}: ${err.message}`);
    }
  }
}

// ============================================
// BULK INSERT FUNCTION
// ============================================
async function bulkInsert(pgClient, tableName, columns, rows) {
  if (rows.length === 0) return 0;
  
  const columnNames = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  let query = `INSERT INTO "${tableName}" (${columnNames}) VALUES `;
  const valueRows = [];
  const allValues = [];
  
  rows.forEach((row, rowIndex) => {
    const rowPlaceholders = columns.map((_, colIndex) => 
      `$${rowIndex * columns.length + colIndex + 1}`
    ).join(', ');
    valueRows.push(`(${rowPlaceholders})`);
    allValues.push(...row);
  });
  
  query += valueRows.join(', ');
  
  try {
    await pgClient.query(query, allValues);
    return rows.length;
  } catch (err) {
    console.error(`❌ Batch insert failed:`, err.message);
    return 0;
  }
}

// ============================================
// RECOVER TABLE
// ============================================
async function recoverTable(sqlPool, pgClient, tableName, expectedCount, truncate = true) {
  console.log(`\n📦 Recovering table: ${tableName}`);
  console.log(`   Expected records: ${expectedCount.toLocaleString()}`);
  console.log('─'.repeat(60));
  
  try {
    // Check if table exists in SQL Server
    const checkTable = await sqlPool.request().query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = '${tableName}'
    `);
    
    if (checkTable.recordset[0].count === 0) {
      console.log(`⚠️ Table ${tableName} not found in SQL Server, skipping...`);
      return 0;
    }
    
    // Get total count from SQL Server
    const countResult = await sqlPool.request().query(`
      SELECT COUNT(*) as total FROM ${tableName}
    `);
    const totalRecords = countResult.recordset[0].total;
    
    if (totalRecords === 0) {
      console.log(`⚠️ No data in ${tableName}`);
      return 0;
    }
    
    console.log(`📊 Found ${totalRecords.toLocaleString()} records in SQL Server`);
    
    // Get columns from SQL Server
    const columns = await getSQLServerColumns(sqlPool, tableName);
    console.log(`📋 Columns: ${columns.length}`);
    
    // Check if table exists in PostgreSQL
    const exists = await tableExistsInPG(pgClient, tableName);
    
    if (!exists) {
      console.log(`⚠️ Table ${tableName} doesn't exist in PostgreSQL. Creating...`);
      const createResult = await sqlPool.request().query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `);
      
      const colDefs = createResult.recordset.map(col => {
        let pgType = 'TEXT';
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
            const maxLen = col.CHARACTER_MAXIMUM_LENGTH;
            if (maxLen === -1 || maxLen === null || maxLen > 255) {
              pgType = 'TEXT';
            } else {
              pgType = `VARCHAR(${maxLen})`;
            }
            break;
          default: pgType = 'TEXT';
        }
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        return `  "${col.COLUMN_NAME}" ${pgType} ${nullable}`;
      });
      
      let createSQL = `CREATE TABLE "${tableName}" (\n${colDefs.join(',\n')}\n)`;
      await pgClient.query(createSQL);
      console.log(`✅ Created table ${tableName} in PostgreSQL`);
    } else if (truncate) {
      console.log(`📌 Clearing existing data from ${tableName}...`);
      await pgClient.query(`DELETE FROM "${tableName}"`);
      console.log(`✅ Cleared ${tableName}`);
    }
    
    // Initialize progress tracker
    const progress = new ProgressTracker(tableName, totalRecords);
    let totalInserted = 0;
    let offset = 0;
    
    console.log(`🔄 Starting batch inserts (${BATCH_SIZE} records per batch)...`);
    
    while (offset < totalRecords) {
      const data = await sqlPool.request().query(`
        SELECT * FROM ${tableName}
        ORDER BY Id
        OFFSET ${offset} ROWS
        FETCH NEXT ${BATCH_SIZE} ROWS ONLY
      `);
      
      if (data.recordset.length === 0) break;
      
      const rows = data.recordset.map(row => {
        return columns.map(col => {
          let val = row[col];
          if (typeof val === 'boolean' || val === true || val === false) {
            return val;
          }
          if (val === null || val === undefined) {
            return null;
          }
          return val;
        });
      });
      
      const inserted = await bulkInsert(pgClient, tableName, columns, rows);
      totalInserted += inserted;
      offset += data.recordset.length;
      
      progress.update(totalInserted);
      
      if (offset < totalRecords) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    progress.complete();
    
    // Verify count
    const verifyResult = await pgClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const pgCount = parseInt(verifyResult.rows[0].count);
    
    if (pgCount === totalRecords) {
      console.log(`✅ All ${totalRecords.toLocaleString()} records recovered successfully`);
    } else {
      console.log(`⚠️ Expected ${totalRecords.toLocaleString()}, got ${pgCount.toLocaleString()}`);
    }
    
    return totalInserted;
    
  } catch (err) {
    console.error(`❌ Error recovering ${tableName}:`, err.message);
    return 0;
  }
}

// ============================================
// CHECK IF TABLE EXISTS
// ============================================
async function tableExistsInPG(pgClient, tableName) {
  const result = await pgClient.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND LOWER(table_name) = LOWER($1)
    )
  `, [tableName]);
  return result.rows[0].exists;
}

// ============================================
// VERIFY ALL TABLES
// ============================================
async function verifyAllTables(pgClient) {
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  
  const tables = [
    'Categories', 'Clients', 'Findings', 'Genders', 
    'Oncologies', 'Roles', 'Stations', 'Tallies', 
    'Users', 'UserRoles'
  ];
  
  const results = [];
  for (const table of tables) {
    try {
      const result = await pgClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
      results.push({ table, count: parseInt(result.rows[0].count) });
    } catch (err) {
      results.push({ table, count: 'ERROR' });
    }
  }
  
  console.log('\n📋 Final Table Counts:');
  console.log('─'.repeat(40));
  results.forEach(({ table, count }) => {
    const paddedTable = table.padEnd(15);
    console.log(`   ${paddedTable} : ${String(count).padStart(10)}`);
  });
  console.log('═'.repeat(60));
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log('========================================');
  console.log('KPA Health - Optimized Data Recovery');
  console.log('========================================\n');
  
  const startTime = Date.now();
  
  try {
    // Connect to SQL Server
    console.log('📌 Connecting to SQL Server...');
    const sqlPool = await sql.connect(sqlConfig);
    console.log('✅ Connected to SQL Server\n');
    
    // Connect to PostgreSQL
    console.log('📌 Connecting to PostgreSQL...');
    const pgClient = new Client(pgConfig);
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL\n');
    
    // Drop foreign keys temporarily
    await dropForeignKeys(pgClient);
    
    // Recover tables in the correct order (parent tables first)
    const tablesToRecover = [
      // Reference tables (already have data, skip truncation)
      { name: 'Roles', expectedCount: 7, truncate: false },
      { name: 'Categories', expectedCount: 3, truncate: false },
      { name: 'Genders', expectedCount: 2, truncate: false },
      { name: 'Stations', expectedCount: 23, truncate: false },
      { name: 'Lipids', expectedCount: 7, truncate: true },
      { name: 'HepatitisBValues', expectedCount: 3, truncate: true },
      { name: 'HepatitisCValues', expectedCount: 3, truncate: true },
      { name: 'BreastExams', expectedCount: 4, truncate: true },
      { name: 'PAPSmears', expectedCount: 3, truncate: true },
      { name: 'ViaVillies', expectedCount: 4, truncate: true },
      { name: 'BPINTValues', expectedCount: 6, truncate: true },
      { name: 'BMIINTValues', expectedCount: 6, truncate: true },
      { name: 'RBSINTValues', expectedCount: 5, truncate: true },
      { name: 'BMDINTValues', expectedCount: 3, truncate: true },
      { name: 'FBSINTValues', expectedCount: 5, truncate: true },
      { name: 'HBA1CINTValues', expectedCount: 3, truncate: true },
      { name: 'PSAINTValues', expectedCount: 3, truncate: true },
      { name: 'MicroalbuminINTValues', expectedCount: 4, truncate: true },
      // Main tables (depend on the above)
      { name: 'Clients', expectedCount: 9219, truncate: true },
      { name: 'Tallies', expectedCount: 13360, truncate: true },
      { name: 'Findings', expectedCount: 2922, truncate: true },
      { name: 'Oncologies', expectedCount: 932, truncate: true },
    ];
    
    let totalRecovered = 0;
    
    for (const table of tablesToRecover) {
      const count = await recoverTable(
        sqlPool, 
        pgClient, 
        table.name, 
        table.expectedCount,
        table.truncate
      );
      totalRecovered += count;
    }
    
    // Recreate foreign keys
    await recreateForeignKeys(pgClient);
    
    await verifyAllTables(pgClient);
    
    // Fix sequences
    console.log('\n🔄 Fixing sequences...');
    const tablesWithSequences = [
      'Categories', 'Clients', 'Findings', 'Genders', 
      'Oncologies', 'Roles', 'Stations', 'Tallies', 'Users'
    ];
    
    for (const table of tablesWithSequences) {
      try {
        const result = await pgClient.query(`SELECT MAX("Id") FROM "${table}"`);
        const maxId = result.rows[0].max || 1;
        await pgClient.query(`ALTER SEQUENCE "${table}_Id_seq" RESTART WITH ${maxId + 1}`);
        console.log(`   ✅ ${table} sequence updated (next: ${maxId + 1})`);
      } catch (err) {
        console.log(`   ⚠️ ${table} sequence: ${err.message}`);
      }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n========================================');
    console.log(`🎉 Recovery complete: ${totalRecovered.toLocaleString()} total records`);
    console.log(`⏱️  Total time: ${elapsed} seconds`);
    console.log('========================================');
    
    await sqlPool.close();
    await pgClient.end();
    
  } catch (err) {
    console.error('\n❌ Recovery failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);