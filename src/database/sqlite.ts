import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { JobInfo, DatabaseJob } from '../types';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export class SQLiteDatabase {
  private db: Database | null = null;
  private isInitialized = false;

  constructor(private dbPath: string = config.databasePath) {
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const SQL = await initSqlJs();
      
      // Try to load existing database file
      let filebuffer: Uint8Array | undefined;
      if (fs.existsSync(this.dbPath)) {
        filebuffer = fs.readFileSync(this.dbPath);
      }
      
      this.db = new SQL.Database(filebuffer);

      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS jobs (
          address TEXT PRIMARY KEY,
          name TEXT,
          last_worked_block INTEGER,
          consecutive_workable_blocks INTEGER DEFAULT 0,
          is_currently_workable BOOLEAN DEFAULT 0,
          last_checked_block INTEGER DEFAULT 0,
          alerts_sent INTEGER DEFAULT 0,
          last_alert_block INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.exec(createTableQuery);
      this.save(); // Save initial state
      logger.info('Database initialized successfully', { path: this.dbPath });
      this.isInitialized = true;
    } catch (err: any) {
      logger.error('Failed to create jobs table', { error: err.message });
      throw err;
    }
  }
  
  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  async upsertJob(jobInfo: JobInfo): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO jobs (
        address,
        name,
        last_worked_block,
        consecutive_workable_blocks,
        is_currently_workable,
        last_checked_block,
        alerts_sent,
        last_alert_block,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params = [
      jobInfo.address,
      jobInfo.name || null,
      jobInfo.lastWorkedBlock || null,
      jobInfo.consecutiveWorkableBlocks,
      jobInfo.isCurrentlyWorkable ? 1 : 0,
      jobInfo.lastCheckedBlock,
      jobInfo.alertsSent,
      jobInfo.lastAlertBlock || null,
    ];

    try {
      this.db.run(query, params);
      this.save(); // Save to file
      logger.debug('Job updated in database', { 
        address: jobInfo.address
      });
    } catch (err: any) {
      logger.error('Failed to upsert job', { 
        address: jobInfo.address, 
        error: err.message 
      });
      throw err;
    }
  }

  async getJob(address: string): Promise<JobInfo | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = 'SELECT * FROM jobs WHERE address = ?';

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.getAsObject([address]) as unknown as DatabaseJob;
      stmt.free();
      
      if (result && result.address) {
        const jobInfo: JobInfo = {
          address: result.address,
          name: result.name || undefined,
          lastWorkedBlock: result.last_worked_block || undefined,
          consecutiveWorkableBlocks: result.consecutive_workable_blocks,
          isCurrentlyWorkable: Boolean(result.is_currently_workable),
          lastCheckedBlock: result.last_checked_block,
          alertsSent: result.alerts_sent,
          lastAlertBlock: result.last_alert_block || undefined,
        };
        return jobInfo;
      } else {
        return null;
      }
    } catch (err: any) {
      logger.error('Failed to get job', { address, error: err.message });
      throw err;
    }
  }

  async getAllJobs(): Promise<JobInfo[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = 'SELECT * FROM jobs ORDER BY address';

    try {
      const stmt = this.db.prepare(query);
      const jobs: JobInfo[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as DatabaseJob;
        jobs.push({
          address: row.address,
          name: row.name || undefined,
          lastWorkedBlock: row.last_worked_block || undefined,
          consecutiveWorkableBlocks: row.consecutive_workable_blocks,
          isCurrentlyWorkable: Boolean(row.is_currently_workable),
          lastCheckedBlock: row.last_checked_block,
          alertsSent: row.alerts_sent,
          lastAlertBlock: row.last_alert_block || undefined,
        });
      }
      stmt.free();
      return jobs;
    } catch (err: any) {
      logger.error('Failed to get all jobs', { error: err.message });
      throw err;
    }
  }

  async getWorkableJobs(): Promise<JobInfo[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = 'SELECT * FROM jobs WHERE is_currently_workable = 1 ORDER BY consecutive_workable_blocks DESC';

    try {
      const stmt = this.db.prepare(query);
      const jobs: JobInfo[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as DatabaseJob;
        jobs.push({
          address: row.address,
          name: row.name || undefined,
          lastWorkedBlock: row.last_worked_block || undefined,
          consecutiveWorkableBlocks: row.consecutive_workable_blocks,
          isCurrentlyWorkable: Boolean(row.is_currently_workable),
          lastCheckedBlock: row.last_checked_block,
          alertsSent: row.alerts_sent,
          lastAlertBlock: row.last_alert_block || undefined,
        });
      }
      stmt.free();
      return jobs;
    } catch (err: any) {
      logger.error('Failed to get workable jobs', { error: err.message });
      throw err;
    }
  }

  async deleteJob(address: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = 'DELETE FROM jobs WHERE address = ?';

    try {
      this.db.run(query, [address]);
      this.save(); // Save to file
      logger.info('Job deleted from database', { address });
    } catch (err: any) {
      logger.error('Failed to delete job', { address, error: err.message });
      throw err;
    }
  }

  async close(): Promise<void> {
    if (!this.db) return;
    
    try {
      this.save(); // Final save
      this.db.close();
      logger.info('Database connection closed');
    } catch (err: any) {
      logger.error('Failed to close database', { error: err.message });
      throw err;
    }
  }
}