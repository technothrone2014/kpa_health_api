// kpa_health_api/src/services/syncService.ts
import sql, { ConnectionPool } from 'mssql';
import { Client, ClientConfig } from 'pg';
import cron from 'node-cron';

interface SyncRecord {
  [key: string]: any;
}

interface KPAConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
  };
}

class SyncService {
  private lastSyncTime: Date = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

  private getKPAConfig(): KPAConfig {
    // Validate required environment variables
    if (!process.env.KPA_DB_HOST) {
      throw new Error('KPA_DB_HOST is not defined');
    }
    if (!process.env.KPA_DB_NAME) {
      throw new Error('KPA_DB_NAME is not defined');
    }
    if (!process.env.KPA_DB_USER) {
      throw new Error('KPA_DB_USER is not defined');
    }
    if (!process.env.KPA_DB_PASSWORD) {
      throw new Error('KPA_DB_PASSWORD is not defined');
    }

    return {
      server: process.env.KPA_DB_HOST,
      database: process.env.KPA_DB_NAME,
      user: process.env.KPA_DB_USER,
      password: process.env.KPA_DB_PASSWORD,
      port: parseInt(process.env.KPA_DB_PORT || '1433'),
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
      }
    };
  }

  private getPostgreSQLClient(): Client {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined');
    }
    
    // Correct PostgreSQL configuration
    const config: ClientConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false  // For self-signed certificates
      }
    };
    
    return new Client(config);
  }

  async syncIncremental(): Promise<void> {
    console.log('🔄 Starting incremental sync...');
    
    let onPremisePool: ConnectionPool | null = null;
    let renderPool: Client | null = null;
    
    try {
      // Get configurations
      const kpaConfig = this.getKPAConfig();
      console.log('📌 Connecting to KPA SQL Server...', {
        server: kpaConfig.server,
        database: kpaConfig.database,
        user: kpaConfig.user
      });
      
      // Connect to on-premise SQL Server (KPA)
      onPremisePool = await sql.connect(kpaConfig);
      console.log('✅ Connected to KPA SQL Server');

      // Connect to Render PostgreSQL
      console.log('📌 Connecting to Render PostgreSQL...');
      renderPool = this.getPostgreSQLClient();
      await renderPool.connect();
      console.log('✅ Connected to Render PostgreSQL');

      // Get changed records since last sync
      const tables = ['Clients', 'Tallies', 'Findings', 'Oncologies'];
      let totalSynced = 0;
      
      for (const table of tables) {
        console.log(`📦 Syncing table: ${table}`);
        
        try {
          // Check if table exists in SQL Server
          const tableCheck = await onPremisePool.request().query(`
            SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = '${table}'
          `);
          
          if (tableCheck.recordset[0].count === 0) {
            console.log(`⚠️ Table ${table} not found in SQL Server, skipping...`);
            continue;
          }
          
          // Query for changed records
          const request = onPremisePool.request();
          request.input('lastSync', sql.DateTime, this.lastSyncTime);
          
          const result = await request.query(`
            SELECT * FROM ${table} 
            WHERE (UpdatedAt >= @lastSync OR CreatedAt >= @lastSync)
              AND Deleted = 0
          `);

          if (result.recordset && result.recordset.length > 0) {
            // Ensure table exists in PostgreSQL
            await this.ensureTableExists(renderPool, table, result.recordset[0]);
            
            // Upsert to PostgreSQL
            let syncedCount = 0;
            for (const record of result.recordset) {
              try {
                await this.upsertRecord(renderPool, table, record);
                syncedCount++;
              } catch (err) {
                console.error(`Error upserting record in ${table}:`, err);
              }
            }
            console.log(`✅ Synced ${syncedCount}/${result.recordset.length} records from ${table}`);
            totalSynced += syncedCount;
          } else {
            console.log(`ℹ️ No changes in ${table}`);
          }
        } catch (err) {
          console.error(`Error processing table ${table}:`, err);
        }
      }

      this.lastSyncTime = new Date();
      console.log(`✅ Sync completed! Total synced: ${totalSynced} records`);
      
    } catch (err) {
      console.error('❌ Sync failed:', err);
    } finally {
      // Clean up connections
      if (onPremisePool) {
        try {
          await onPremisePool.close();
          console.log('🔒 Closed KPA SQL Server connection');
        } catch (err) {
          console.error('Error closing KPA connection:', err);
        }
      }
      if (renderPool) {
        try {
          await renderPool.end();
          console.log('🔒 Closed Render PostgreSQL connection');
        } catch (err) {
          console.error('Error closing PostgreSQL connection:', err);
        }
      }
    }
  }

  private async ensureTableExists(
    pgClient: Client, 
    tableName: string, 
    sampleRecord: SyncRecord
  ): Promise<void> {
    try {
      // Check if table exists
      const checkResult = await pgClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName.toLowerCase()]);
      
      if (!checkResult.rows[0].exists) {
        // Create table based on sample record structure
        const columns = Object.keys(sampleRecord).map(key => {
          let pgType = 'TEXT';
          const value = sampleRecord[key];
          
          if (typeof value === 'number') pgType = 'INTEGER';
          else if (value instanceof Date) pgType = 'TIMESTAMP';
          else if (typeof value === 'boolean') pgType = 'BOOLEAN';
          else if (key.toLowerCase().includes('id')) pgType = 'SERIAL';
          
          return `"${key}" ${pgType}`;
        }).join(',\n  ');
        
        const createQuery = `
          CREATE TABLE IF NOT EXISTS "${tableName.toLowerCase()}" (
            ${columns}
          )
        `;
        
        await pgClient.query(createQuery);
        console.log(`✅ Created table: ${tableName}`);
      }
    } catch (err) {
      console.error(`Error ensuring table ${tableName}:`, err);
    }
  }

  private async upsertRecord(
    pgClient: Client, 
    tableName: string, 
    record: SyncRecord
  ): Promise<void> {
    const keys = Object.keys(record);
    const columns = keys.map(key => `"${key}"`).join(', ');
    const values = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys.map(key => `"${key}" = EXCLUDED."${key}"`).join(', ');
    
    const query = `
      INSERT INTO "${tableName.toLowerCase()}" (${columns})
      VALUES (${values})
      ON CONFLICT (id) DO UPDATE SET ${updates}
    `;
    
    await pgClient.query(query, Object.values(record));
  }

  startAutoSync(): void {
    // Run every hour
    const task = cron.schedule('0 * * * *', () => {
      console.log('⏰ Running scheduled sync...');
      this.syncIncremental().catch(err => {
        console.error('Scheduled sync failed:', err);
      });
    });
    task.start();
    console.log('🕐 Auto-sync scheduled (every hour)');
  }
  
  // Manual sync trigger
  async manualSync(): Promise<void> {
    console.log('🔧 Manual sync triggered');
    await this.syncIncremental();
  }
}

// Export a singleton instance
export default new SyncService();