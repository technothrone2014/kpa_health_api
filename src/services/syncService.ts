import sql, { ConnectionPool } from 'mssql';
import { Client } from 'pg';
import cron from 'node-cron';
import { poolPromise as pgPool } from '../db/pool';

interface SyncRecord {
  [key: string]: any;
}

interface SyncStats {
  clientsSynced: number;
  talliesSynced: number;
  findingsSynced: number;
  oncologiesSynced: number;
  errors: string[];
}

class SyncService {
  private lastSyncTime: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  private isSyncing: boolean = false;
  private sqlServerPool: ConnectionPool | null = null;
  private syncEnabled: boolean = process.env.KPA_SYNC_ENABLED === 'true';
  private syncIntervalMinutes: number = parseInt(process.env.KPA_SYNC_INTERVAL_MINUTES || '5');

  // Get KPA SQL Server configuration with Windows Authentication
  private getKPAConfig(): sql.config {
    const useWindowsAuth = process.env.KPA_WINDOWS_AUTHENTICATION === 'true';
    const port = parseInt(process.env.KPA_SERVER_PORT || '1433');
    
    console.log('🔧 KPA SQL Server Config:', {
      server: process.env.KPA_DB_HOST,
      port: port,
      database: process.env.KPA_DB_NAME,
      windowsAuth: useWindowsAuth,
      syncEnabled: this.syncEnabled
    });

    const baseConfig: sql.config = {
      server: process.env.KPA_DB_HOST!,
      port: port,
      database: process.env.KPA_DB_NAME!,
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    };

    if (useWindowsAuth) {
      // Windows Authentication (NTLM)
      return {
        ...baseConfig,
        authentication: {
          type: 'ntlm',
          options: {
            userName: process.env.KPA_DB_USER || '',
            password: process.env.KPA_DB_PASSWORD || '',
            domain: process.env.KPA_DB_DOMAIN || '',
          },
        },
      };
    } else {
      // SQL Server Authentication
      return {
        ...baseConfig,
        authentication: {
          type: 'default',
          options: {
            userName: process.env.KPA_DB_USER!,
            password: process.env.KPA_DB_PASSWORD!,
          },
        },
      };
    }
  }

  // Connect to KPA SQL Server
  private async connectToSQLServer(): Promise<boolean> {
    try {
      if (this.sqlServerPool) {
        // Test connection
        await this.sqlServerPool.query('SELECT 1');
        return true;
      }

      const config = this.getKPAConfig();
      this.sqlServerPool = await sql.connect(config);
      console.log('✅ Connected to KPA SQL Server successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to KPA SQL Server:', error);
      this.sqlServerPool = null;
      return false;
    }
  }

  // Sync new/updated clients from PostgreSQL to SQL Server
  private async syncClientsToSQLServer(pg: Client): Promise<number> {
    if (!this.sqlServerPool) return 0;

    // Get clients not yet synced or updated since last sync
    const clients = await pg.query(`
      SELECT * FROM "Clients" 
      WHERE ("SyncedToSQLServer" = false OR "UpdatedOn" > "SyncedAt")
        AND "Deleted" = false
      ORDER BY "Id"
      LIMIT 100
    `);

    if (clients.rows.length === 0) return 0;

    console.log(`🔄 Syncing ${clients.rows.length} clients to SQL Server...`);
    let synced = 0;

    for (const client of clients.rows) {
      const transaction = this.sqlServerPool.transaction();
      await transaction.begin();

      try {
        // Check if client exists in SQL Server
        const checkResult = await transaction.request()
          .input('Id', sql.Int, client.Id)
          .query('SELECT Id FROM Clients WHERE Id = @Id');

        if (checkResult.recordset.length === 0) {
          // Insert new client
          await transaction.request()
            .input('Id', sql.Int, client.Id)
            .input('UserId', sql.Int, client.UserId)
            .input('IDNumber', sql.NVarChar(20), client.IDNumber)
            .input('FullName', sql.NVarChar(40), client.FullName)
            .input('FirstName', sql.NVarChar(20), client.FirstName)
            .input('LastName', sql.NVarChar(20), client.LastName)
            .input('GenderId', sql.Int, client.GenderId)
            .input('PhoneNumber', sql.NVarChar(20), client.PhoneNumber)
            .input('CategoryId', sql.Int, client.CategoryId)
            .input('StationId', sql.Int, client.StationId)
            .input('DateOfBirth', sql.Date, client.DateOfBirth)
            .input('PostedOn', sql.DateTime2, client.PostedOn)
            .input('UpdatedOn', sql.DateTime2, client.UpdatedOn)
            .input('Pinned', sql.Bit, client.Pinned)
            .input('Status', sql.Bit, client.Status)
            .input('Deleted', sql.Bit, client.Deleted)
            .query(`
              INSERT INTO Clients 
              (Id, UserId, IDNumber, FullName, FirstName, LastName, GenderId, 
               PhoneNumber, CategoryId, StationId, DateOfBirth, PostedOn, UpdatedOn, 
               Pinned, Status, Deleted)
              VALUES 
              (@Id, @UserId, @IDNumber, @FullName, @FirstName, @LastName, @GenderId,
               @PhoneNumber, @CategoryId, @StationId, @DateOfBirth, @PostedOn, @UpdatedOn,
               @Pinned, @Status, @Deleted)
            `);
        } else {
          // Update existing client
          await transaction.request()
            .input('Id', sql.Int, client.Id)
            .input('FullName', sql.NVarChar(40), client.FullName)
            .input('FirstName', sql.NVarChar(20), client.FirstName)
            .input('LastName', sql.NVarChar(20), client.LastName)
            .input('PhoneNumber', sql.NVarChar(20), client.PhoneNumber)
            .input('StationId', sql.Int, client.StationId)
            .input('UpdatedOn', sql.DateTime2, client.UpdatedOn)
            .query(`
              UPDATE Clients 
              SET FullName = @FullName,
                  FirstName = @FirstName,
                  LastName = @LastName,
                  PhoneNumber = @PhoneNumber,
                  StationId = @StationId,
                  UpdatedOn = @UpdatedOn
              WHERE Id = @Id
            `);
        }

        // Mark as synced in PostgreSQL
        await pg.query(
          `UPDATE "Clients" SET "SyncedToSQLServer" = true, "SyncedAt" = NOW() WHERE "Id" = $1`,
          [client.Id]
        );

        await transaction.commit();
        synced++;
        
        if (synced % 10 === 0) {
          console.log(`   Synced ${synced}/${clients.rows.length} clients...`);
        }
      } catch (err) {
        await transaction.rollback();
        console.error(`Failed to sync client ${client.Id}:`, err);
      }
    }

    console.log(`✅ Synced ${synced} clients to SQL Server`);
    return synced;
  }

  // Sync tallies from PostgreSQL to SQL Server
  private async syncTalliesToSQLServer(pg: Client): Promise<number> {
    if (!this.sqlServerPool) return 0;

    const tallies = await pg.query(`
      SELECT * FROM "Tallies" 
      WHERE ("SyncedToSQLServer" = false OR "UpdatedOn" > "SyncedAt")
        AND "Deleted" = false
      ORDER BY "Id"
      LIMIT 100
    `);

    if (tallies.rows.length === 0) return 0;

    console.log(`🔄 Syncing ${tallies.rows.length} tallies to SQL Server...`);
    let synced = 0;

    for (const tally of tallies.rows) {
      const transaction = this.sqlServerPool.transaction();
      await transaction.begin();

      try {
        await transaction.request()
          .input('Id', sql.Int, tally.Id)
          .input('UserId', sql.Int, tally.UserId)
          .input('ClientId', sql.Int, tally.ClientId)
          .input('GenderId', sql.Int, tally.GenderId)
          .input('CategoryId', sql.Int, tally.CategoryId)
          .input('StationId', sql.Int, tally.StationId)
          .input('Age', sql.TinyInt, tally.Age)
          .input('Weight', sql.Decimal(18, 4), tally.Weight)
          .input('Height', sql.Decimal(18, 4), tally.Height)
          .input('BMIValue', sql.Decimal(18, 4), tally.BMIValue)
          .input('BMIINTValueId', sql.Int, tally.BMIINTValueId)
          .input('Waist', sql.Decimal(18, 4), tally.Waist)
          .input('Hip', sql.Decimal(18, 4), tally.Hip)
          .input('WHRatio', sql.Decimal(18, 4), tally.WHRatio)
          .input('Systolic', sql.SmallInt, tally.Systolic)
          .input('Diastolic', sql.SmallInt, tally.Diastolic)
          .input('BPINTValueId', sql.Int, tally.BPINTValueId)
          .input('RBSValue', sql.Decimal(18, 4), tally.RBSValue)
          .input('RBSINTValueId', sql.Int, tally.RBSINTValueId)
          .input('PostedOn', sql.DateTime2, tally.PostedOn)
          .input('UpdatedOn', sql.DateTime2, tally.UpdatedOn)
          .input('Pinned', sql.Bit, tally.Pinned)
          .input('Status', sql.Bit, tally.Status)
          .input('Deleted', sql.Bit, tally.Deleted)
          .query(`
            INSERT INTO Tallies 
            (Id, UserId, ClientId, GenderId, CategoryId, StationId, Age, Weight, Height,
             BMIValue, BMIINTValueId, Waist, Hip, WHRatio, Systolic, Diastolic, BPINTValueId,
             RBSValue, RBSINTValueId, PostedOn, UpdatedOn, Pinned, Status, Deleted)
            VALUES 
            (@Id, @UserId, @ClientId, @GenderId, @CategoryId, @StationId, @Age, @Weight, @Height,
             @BMIValue, @BMIINTValueId, @Waist, @Hip, @WHRatio, @Systolic, @Diastolic, @BPINTValueId,
             @RBSValue, @RBSINTValueId, @PostedOn, @UpdatedOn, @Pinned, @Status, @Deleted)
          `);

        await pg.query(
          `UPDATE "Tallies" SET "SyncedToSQLServer" = true, "SyncedAt" = NOW() WHERE "Id" = $1`,
          [tally.Id]
        );

        await transaction.commit();
        synced++;
      } catch (err) {
        await transaction.rollback();
        console.error(`Failed to sync tally ${tally.Id}:`, err);
      }
    }

    console.log(`✅ Synced ${synced} tallies to SQL Server`);
    return synced;
  }

  // Sync findings from PostgreSQL to SQL Server
  private async syncFindingsToSQLServer(pg: Client): Promise<number> {
    if (!this.sqlServerPool) return 0;

    const findings = await pg.query(`
      SELECT * FROM "Findings" 
      WHERE ("SyncedToSQLServer" = false OR "UpdatedOn" > "SyncedAt")
        AND "Deleted" = false
      ORDER BY "Id"
      LIMIT 100
    `);

    if (findings.rows.length === 0) return 0;

    console.log(`🔄 Syncing ${findings.rows.length} findings to SQL Server...`);
    let synced = 0;

    for (const finding of findings.rows) {
      const transaction = this.sqlServerPool.transaction();
      await transaction.begin();

      try {
        await transaction.request()
          .input('Id', sql.Int, finding.Id)
          .input('UserId', sql.Int, finding.UserId)
          .input('ClientId', sql.Int, finding.ClientId)
          .input('GenderId', sql.Int, finding.GenderId)
          .input('CategoryId', sql.Int, finding.CategoryId)
          .input('StationId', sql.Int, finding.StationId)
          .input('MicroalbuminValue', sql.Decimal(18, 4), finding.MicroalbuminValue)
          .input('MicroalbuminINTValueId', sql.Int, finding.MicroalbuminINTValueId)
          .input('FBSValue', sql.Decimal(18, 4), finding.FBSValue)
          .input('FBSINTValueId', sql.Int, finding.FBSINTValueId)
          .input('HBA1CValue', sql.Decimal(18, 4), finding.HBA1CValue)
          .input('HBA1CINTValueId', sql.Int, finding.HBA1CINTValueId)
          .input('BMDValue', sql.Decimal(18, 4), finding.BMDValue)
          .input('BMDINTValueId', sql.Int, finding.BMDINTValueId)
          .input('PSAValue', sql.Decimal(18, 4), finding.PSAValue)
          .input('PSAINTValueId', sql.Int, finding.PSAINTValueId)
          .input('LipidId', sql.Int, finding.LipidId)
          .input('HepatitisBValueId', sql.Int, finding.HepatitisBValueId)
          .input('HepatitisCValueId', sql.Int, finding.HepatitisCValueId)
          .input('PostedOn', sql.DateTime2, finding.PostedOn)
          .input('UpdatedOn', sql.DateTime2, finding.UpdatedOn)
          .input('Pinned', sql.Bit, finding.Pinned)
          .input('Status', sql.Bit, finding.Status)
          .input('Deleted', sql.Bit, finding.Deleted)
          .query(`
            INSERT INTO Findings 
            (Id, UserId, ClientId, GenderId, CategoryId, StationId,
             MicroalbuminValue, MicroalbuminINTValueId, FBSValue, FBSINTValueId,
             HBA1CValue, HBA1CINTValueId, BMDValue, BMDINTValueId, PSAValue, PSAINTValueId,
             LipidId, HepatitisBValueId, HepatitisCValueId, PostedOn, UpdatedOn, Pinned, Status, Deleted)
            VALUES 
            (@Id, @UserId, @ClientId, @GenderId, @CategoryId, @StationId,
             @MicroalbuminValue, @MicroalbuminINTValueId, @FBSValue, @FBSINTValueId,
             @HBA1CValue, @HBA1CINTValueId, @BMDValue, @BMDINTValueId, @PSAValue, @PSAINTValueId,
             @LipidId, @HepatitisBValueId, @HepatitisCValueId, @PostedOn, @UpdatedOn, @Pinned, @Status, @Deleted)
          `);

        await pg.query(
          `UPDATE "Findings" SET "SyncedToSQLServer" = true, "SyncedAt" = NOW() WHERE "Id" = $1`,
          [finding.Id]
        );

        await transaction.commit();
        synced++;
      } catch (err) {
        await transaction.rollback();
        console.error(`Failed to sync finding ${finding.Id}:`, err);
      }
    }

    console.log(`✅ Synced ${synced} findings to SQL Server`);
    return synced;
  }

  // Sync oncology records from PostgreSQL to SQL Server
  private async syncOncologiesToSQLServer(pg: Client): Promise<number> {
    if (!this.sqlServerPool) return 0;

    const oncologies = await pg.query(`
      SELECT * FROM "Oncologies" 
      WHERE ("SyncedToSQLServer" = false OR "UpdatedOn" > "SyncedAt")
        AND "Deleted" = false
      ORDER BY "Id"
      LIMIT 100
    `);

    if (oncologies.rows.length === 0) return 0;

    console.log(`🔄 Syncing ${oncologies.rows.length} oncology records to SQL Server...`);
    let synced = 0;

    for (const oncology of oncologies.rows) {
      const transaction = this.sqlServerPool.transaction();
      await transaction.begin();

      try {
        await transaction.request()
          .input('Id', sql.Int, oncology.Id)
          .input('UserId', sql.Int, oncology.UserId)
          .input('ClientId', sql.Int, oncology.ClientId)
          .input('GenderId', sql.Int, oncology.GenderId)
          .input('CategoryId', sql.Int, oncology.CategoryId)
          .input('StationId', sql.Int, oncology.StationId)
          .input('BreastExamId', sql.Int, oncology.BreastExamId)
          .input('PAPSmearId', sql.Int, oncology.PAPSmearId)
          .input('ViaVilliId', sql.Int, oncology.ViaVilliId)
          .input('PostedOn', sql.DateTime2, oncology.PostedOn)
          .input('UpdatedOn', sql.DateTime2, oncology.UpdatedOn)
          .input('Pinned', sql.Bit, oncology.Pinned)
          .input('Status', sql.Bit, oncology.Status)
          .input('Deleted', sql.Bit, oncology.Deleted)
          .query(`
            INSERT INTO Oncologies 
            (Id, UserId, ClientId, GenderId, CategoryId, StationId,
             BreastExamId, PAPSmearId, ViaVilliId, PostedOn, UpdatedOn, Pinned, Status, Deleted)
            VALUES 
            (@Id, @UserId, @ClientId, @GenderId, @CategoryId, @StationId,
             @BreastExamId, @PAPSmearId, @ViaVilliId, @PostedOn, @UpdatedOn, @Pinned, @Status, @Deleted)
          `);

        await pg.query(
          `UPDATE "Oncologies" SET "SyncedToSQLServer" = true, "SyncedAt" = NOW() WHERE "Id" = $1`,
          [oncology.Id]
        );

        await transaction.commit();
        synced++;
      } catch (err) {
        await transaction.rollback();
        console.error(`Failed to sync oncology ${oncology.Id}:`, err);
      }
    }

    console.log(`✅ Synced ${synced} oncology records to SQL Server`);
    return synced;
  }

  // Pull updates from SQL Server to PostgreSQL (bidirectional sync)
  private async pullFromSQLServer(pg: Client): Promise<void> {
    if (!this.sqlServerPool) return;

    try {
      // Get clients updated in SQL Server since last sync
      const clients = await this.sqlServerPool.request()
        .input('lastSync', sql.DateTime, this.lastSyncTime)
        .query(`
          SELECT * FROM Clients 
          WHERE (UpdatedOn >= @lastSync OR PostedOn >= @lastSync)
            AND Deleted = 0
        `);

      for (const client of clients.recordset) {
        await pg.query(`
          INSERT INTO "Clients" 
          ("Id", "UserId", "IDNumber", "FullName", "FirstName", "LastName", "GenderId",
           "PhoneNumber", "CategoryId", "StationId", "DateOfBirth", "PostedOn", "UpdatedOn", 
           "Pinned", "Status", "Deleted", "SyncedToSQLServer", "SyncedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, NOW())
          ON CONFLICT ("Id") DO UPDATE SET
            "FullName" = EXCLUDED."FullName",
            "FirstName" = EXCLUDED."FirstName",
            "LastName" = EXCLUDED."LastName",
            "PhoneNumber" = EXCLUDED."PhoneNumber",
            "StationId" = EXCLUDED."StationId",
            "UpdatedOn" = EXCLUDED."UpdatedOn",
            "SyncedToSQLServer" = true,
            "SyncedAt" = NOW()
        `, [
          client.Id, client.UserId, client.IDNumber, client.FullName, client.FirstName,
          client.LastName, client.GenderId, client.PhoneNumber, client.CategoryId,
          client.StationId, client.DateOfBirth, client.PostedOn, client.UpdatedOn,
          client.Pinned, client.Status, client.Deleted
        ]);
      }

      if (clients.recordset.length > 0) {
        console.log(`✅ Pulled ${clients.recordset.length} client updates from SQL Server`);
      }
    } catch (error) {
      console.error('Error pulling updates from SQL Server:', error);
    }
  }

  // Main sync function
  async syncIncremental(): Promise<SyncStats> {
    const stats: SyncStats = {
      clientsSynced: 0,
      talliesSynced: 0,
      findingsSynced: 0,
      oncologiesSynced: 0,
      errors: []
    };

    if (!this.syncEnabled) {
      console.log('⚠️ Sync is disabled (KPA_SYNC_ENABLED=false)');
      return stats;
    }

    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...');
      return stats;
    }

    this.isSyncing = true;
    console.log('🔄 Starting incremental sync...');
    const startTime = Date.now();

    try {
      // Connect to SQL Server
      const connected = await this.connectToSQLServer();
      if (!connected) {
        stats.errors.push('Failed to connect to KPA SQL Server');
        return stats;
      }

      // Get PostgreSQL client
      const pg = await pgPool;

      // Push to SQL Server
      stats.clientsSynced = await this.syncClientsToSQLServer(pg);
      stats.talliesSynced = await this.syncTalliesToSQLServer(pg);
      stats.findingsSynced = await this.syncFindingsToSQLServer(pg);
      stats.oncologiesSynced = await this.syncOncologiesToSQLServer(pg);

      // Pull from SQL Server (bidirectional)
      await this.pullFromSQLServer(pg);

      this.lastSyncTime = new Date();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed in ${duration}ms`, stats);
      
    } catch (err) {
      console.error('❌ Sync failed:', err);
      stats.errors.push(err.message);
    } finally {
      this.isSyncing = false;
    }

    return stats;
  }

  // Start automatic sync
  startAutoSync(): void {
    if (!this.syncEnabled) {
      console.log('⚠️ Auto-sync is disabled (KPA_SYNC_ENABLED=false)');
      return;
    }

    // Run every X minutes
    const cronPattern = `*/${this.syncIntervalMinutes} * * * *`;
    const task = cron.schedule(cronPattern, () => {
      this.syncIncremental().catch(err => {
        console.error('Scheduled sync failed:', err);
      });
    });
    
    task.start();
    console.log(`🕐 Auto-sync scheduled every ${this.syncIntervalMinutes} minutes`);
    
    // Run initial sync after 10 seconds
    setTimeout(() => {
      console.log('🔄 Running initial sync...');
      this.syncIncremental().catch(err => {
        console.error('Initial sync failed:', err);
      });
    }, 10000);
  }
  
  // Manual sync trigger
  async manualSync(): Promise<SyncStats> {
    console.log('🔧 Manual sync triggered');
    return await this.syncIncremental();
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    enabled: boolean;
    connected: boolean;
    lastSyncTime: Date;
    isSyncing: boolean;
  }> {
    const connected = await this.connectToSQLServer();
    return {
      enabled: this.syncEnabled,
      connected,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing
    };
  }
}

// Export a singleton instance
export default new SyncService();
