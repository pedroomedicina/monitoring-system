import { SQLiteDatabase } from '../src/database/sqlite';
import { JobInfo } from '../src/types';

describe('SQLiteDatabase', () => {
  let database: SQLiteDatabase;

  beforeEach(async () => {
    // Use in-memory database for testing
    database = new SQLiteDatabase(':memory:');
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
  });

  describe('Job Operations', () => {
    const mockJob: JobInfo = {
      address: '0x67AD4000e73579B9725eE3A149F85C4Af0A61361',
      name: 'AutoLineJob',
      consecutiveWorkableBlocks: 5,
      isCurrentlyWorkable: true,
      lastCheckedBlock: 18500000,
      alertsSent: 1,
      lastAlertBlock: 18499995,
    };

    it('should upsert a job successfully', async () => {
      await expect(database.upsertJob(mockJob)).resolves.not.toThrow();
    });

    it('should retrieve a job by address', async () => {
      await database.upsertJob(mockJob);
      
      const retrievedJob = await database.getJob(mockJob.address);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob!.address).toBe(mockJob.address);
      expect(retrievedJob!.name).toBe(mockJob.name);
      expect(retrievedJob!.consecutiveWorkableBlocks).toBe(mockJob.consecutiveWorkableBlocks);
      expect(retrievedJob!.isCurrentlyWorkable).toBe(mockJob.isCurrentlyWorkable);
      expect(retrievedJob!.lastCheckedBlock).toBe(mockJob.lastCheckedBlock);
      expect(retrievedJob!.alertsSent).toBe(mockJob.alertsSent);
      expect(retrievedJob!.lastAlertBlock).toBe(mockJob.lastAlertBlock);
    });

    it('should return null for non-existent job', async () => {
      const job = await database.getJob('0x1234567890123456789012345678901234567890');
      expect(job).toBeNull();
    });

    it('should update existing job', async () => {
      await database.upsertJob(mockJob);
      
      const updatedJob: JobInfo = {
        ...mockJob,
        consecutiveWorkableBlocks: 10,
        alertsSent: 2,
      };
      
      await database.upsertJob(updatedJob);
      
      const retrievedJob = await database.getJob(mockJob.address);
      expect(retrievedJob!.consecutiveWorkableBlocks).toBe(10);
      expect(retrievedJob!.alertsSent).toBe(2);
    });

    it('should retrieve all jobs', async () => {
      const job1: JobInfo = {
        address: '0x67AD4000e73579B9725eE3A149F85C4Af0A61361',
        name: 'AutoLineJob',
        consecutiveWorkableBlocks: 5,
        isCurrentlyWorkable: true,
        lastCheckedBlock: 18500000,
        alertsSent: 0,
      };

      const job2: JobInfo = {
        address: '0x8F8f2FC1F0380B9Ff4fE5c3142d0811aC89E32fB',
        name: 'LerpJob',
        consecutiveWorkableBlocks: 0,
        isCurrentlyWorkable: false,
        lastCheckedBlock: 18500000,
        alertsSent: 0,
      };

      await database.upsertJob(job1);
      await database.upsertJob(job2);
      
      const allJobs = await database.getAllJobs();
      
      expect(allJobs).toHaveLength(2);
      expect(allJobs.map(j => j.address)).toContain(job1.address);
      expect(allJobs.map(j => j.address)).toContain(job2.address);
    });

    it('should retrieve only workable jobs', async () => {
      const workableJob: JobInfo = {
        address: '0x67AD4000e73579B9725eE3A149F85C4Af0A61361',
        name: 'AutoLineJob',
        consecutiveWorkableBlocks: 5,
        isCurrentlyWorkable: true,
        lastCheckedBlock: 18500000,
        alertsSent: 0,
      };

      const nonWorkableJob: JobInfo = {
        address: '0x8F8f2FC1F0380B9Ff4fE5c3142d0811aC89E32fB',
        name: 'LerpJob',
        consecutiveWorkableBlocks: 0,
        isCurrentlyWorkable: false,
        lastCheckedBlock: 18500000,
        alertsSent: 0,
      };

      await database.upsertJob(workableJob);
      await database.upsertJob(nonWorkableJob);
      
      const workableJobs = await database.getWorkableJobs();
      
      expect(workableJobs).toHaveLength(1);
      expect(workableJobs[0].address).toBe(workableJob.address);
      expect(workableJobs[0].isCurrentlyWorkable).toBe(true);
    });

    it('should delete a job', async () => {
      await database.upsertJob(mockJob);
      
      // Verify job exists
      let job = await database.getJob(mockJob.address);
      expect(job).toBeDefined();
      
      // Delete job
      await database.deleteJob(mockJob.address);
      
      // Verify job is deleted
      job = await database.getJob(mockJob.address);
      expect(job).toBeNull();
    });

    it('should handle jobs without optional fields', async () => {
      const minimalJob: JobInfo = {
        address: '0x1234567890123456789012345678901234567890',
        consecutiveWorkableBlocks: 0,
        isCurrentlyWorkable: false,
        lastCheckedBlock: 18500000,
        alertsSent: 0,
      };

      await database.upsertJob(minimalJob);
      
      const retrievedJob = await database.getJob(minimalJob.address);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob!.name).toBeUndefined();
      expect(retrievedJob!.lastWorkedBlock).toBeUndefined();
      expect(retrievedJob!.lastAlertBlock).toBeUndefined();
    });
  });

  describe('Database Initialization', () => {
    it('should initialize database tables', async () => {
      const newDb = new SQLiteDatabase(':memory:');
      await expect(newDb.initialize()).resolves.not.toThrow();
      await newDb.close();
    });

    it('should not reinitialize if already initialized', async () => {
      // database is already initialized in beforeEach
      await expect(database.initialize()).resolves.not.toThrow();
    });
  });
});