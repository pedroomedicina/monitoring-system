import { EthereumService } from './ethereum';
import { DiscordService } from './discord';
import { SQLiteDatabase } from '../database/sqlite';
import { JobInfo, JobStatus, AlertData } from '../types';
import { logger, monitorLogger } from '../utils/logger';
import { config } from '../utils/config';
import { KNOWN_JOBS } from '../contracts/sequencer';

export class MonitoringService {
  private ethereum: EthereumService;
  private discord: DiscordService;
  private database: SQLiteDatabase;
  private isRunning = false;
  private monitoringInterval?: ReturnType<typeof setInterval>;
  private lastProcessedBlock = 0;
  private jobAddresses: string[] = [];

  constructor() {
    this.ethereum = new EthereumService();
    this.discord = new DiscordService();
    this.database = new SQLiteDatabase();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing monitoring service...');

      // Initialize database
      await this.database.initialize();

      // Test connections
      await this.ethereum.healthCheck();
      await this.discord.testWebhook();

      // Load job addresses from the Sequencer
      await this.loadJobAddresses();

      // Initialize job tracking in database
      await this.initializeJobTracking();

      // Get the latest block to start monitoring from
      const latestBlock = await this.ethereum.getLatestBlock();
      this.lastProcessedBlock = latestBlock.number;

      logger.info('Monitoring service initialized successfully', {
        jobCount: this.jobAddresses.length,
        startingBlock: this.lastProcessedBlock,
      });
    } catch (error) {
      logger.error('Failed to initialize monitoring service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitoring service is already running');
      return;
    }

    this.isRunning = true;
    monitorLogger.startup(config as unknown as Record<string, unknown>);

    try {
      // Start the monitoring loop
      this.monitoringInterval = setInterval(
        () => this.monitoringLoop().catch(error => {
          logger.error('Error in monitoring loop', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }),
        config.checkIntervalSeconds * 1000
      );

      // Run initial check
      await this.monitoringLoop();

      logger.info('Monitoring service started', {
        interval: config.checkIntervalSeconds,
        threshold: config.alertThresholdBlocks,
      });
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start monitoring service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    monitorLogger.shutdown();

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    await this.ethereum.disconnect();
    await this.database.close();

    logger.info('Monitoring service stopped');
  }

  private async loadJobAddresses(): Promise<void> {
    try {
      this.jobAddresses = await this.ethereum.getAllJobAddresses();
      logger.info('Loaded job addresses from Sequencer', {
        count: this.jobAddresses.length,
        addresses: this.jobAddresses,
      });
    } catch (error) {
      logger.error('Failed to load job addresses', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async initializeJobTracking(): Promise<void> {
    for (const address of this.jobAddresses) {
      const existingJob = await this.database.getJob(address);
      
      if (!existingJob) {
        // Create new job entry
        const jobInfo: JobInfo = {
          address,
          name: this.getJobName(address),
          consecutiveWorkableBlocks: 0,
          isCurrentlyWorkable: false,
          lastCheckedBlock: this.lastProcessedBlock,
          alertsSent: 0,
        };

        await this.database.upsertJob(jobInfo);
        logger.debug('Initialized tracking for new job', { address, name: jobInfo.name });
      }
    }
  }

  private async monitoringLoop(): Promise<void> {
    try {
      const currentBlock = await this.ethereum.getLatestBlock();
      
      // Skip if no new blocks
      if (currentBlock.number <= this.lastProcessedBlock) {
        return;
      }

      // Implement batch limiting to prevent RPC overload
      const blocksToProcess = Math.min(
        currentBlock.number - this.lastProcessedBlock,
        config.maxBlocksPerQuery
      );
      
      const endBlock = this.lastProcessedBlock + blocksToProcess;

      logger.debug('Processing blocks with limit', {
        from: this.lastProcessedBlock + 1,
        to: endBlock,
        total: blocksToProcess,
        latest: currentBlock.number
      });

      // Process blocks with retry logic
      let successfullyProcessed = this.lastProcessedBlock;
      
      for (let blockNum = this.lastProcessedBlock + 1; blockNum <= endBlock; blockNum++) {
        try {
          await this.processBlockWithRetry(blockNum);
          successfullyProcessed = blockNum; // Track progress
        } catch (error) {
          logger.error('Failed to process block after all retries - skipping', {
            blockNumber: blockNum,
            error: error instanceof Error ? error.message : 'Unknown error',
            willSkipBlock: true
          });
          
          // Skip this block and continue with the next one
          // This prevents getting stuck on problematic blocks
          successfullyProcessed = blockNum;
        }
      }

      this.lastProcessedBlock = successfullyProcessed;
      
      // Log if we're still catching up
      if (endBlock < currentBlock.number) {
        logger.info('Still catching up on blocks', {
          processed: endBlock,
          latest: currentBlock.number,
          remaining: currentBlock.number - endBlock
        });
      }
      
      monitorLogger.blockProcessed(endBlock, this.jobAddresses.length);
    } catch (error) {
      logger.error('Error in monitoring loop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processBlockWithRetry(blockNumber: number, retries = 3): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.processBlock(blockNumber);
        return; // Success
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        
        // Check if it's a rate limiting error (improved detection)
        const isRateLimited = errorMsg.toLowerCase().includes('rate limit') || 
                             errorMsg.toLowerCase().includes('too many requests') ||
                             errorMsg.toLowerCase().includes('429') ||
                             errorMsg.toLowerCase().includes('-32005');
        
        // Debug log to see what error we're getting
        logger.debug('Processing block error details', {
          blockNumber,
          attempt: attempt + 1,
          errorMessage: errorMsg.substring(0, 200), // First 200 chars
          isRateLimited
        });
        
        if (isRateLimited) {
          const delay = Math.pow(3, attempt + 4) * 1000;
          logger.warn(`Rate limited, backing off for ${delay}ms`, { 
            blockNumber, 
            attempt: attempt + 1,
            maxRetries: retries 
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // For non-rate-limit errors, throw immediately
        logger.error('Error processing block (non-rate-limit)', {
          blockNumber,
          attempt: attempt + 1,
          error: errorMsg
        });
        throw error;
      }
    }
    
    throw new Error(`Failed to process block ${blockNumber} after ${retries} attempts due to rate limiting`);
  }

  private async processBlock(blockNumber: number): Promise<void> {
    try {
      // Check workable status for all jobs
      const jobStatuses = await this.ethereum.checkMultipleJobsWorkable(
        this.jobAddresses,
        blockNumber
      );

      // Process each job status
      for (const jobStatus of jobStatuses) {
        await this.processJobStatus(jobStatus, blockNumber);
      }
    } catch (error) {
      logger.error('Error processing block', {
        blockNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error; // Re-throw so processBlockWithRetry can handle it
    }
  }

  private async processJobStatus(jobStatus: JobStatus, blockNumber: number): Promise<void> {
    try {
      let jobInfo = await this.database.getJob(jobStatus.address);
      
      if (!jobInfo) {
        // Initialize if not exists
        jobInfo = {
          address: jobStatus.address,
          name: this.getJobName(jobStatus.address),
          consecutiveWorkableBlocks: 0,
          isCurrentlyWorkable: false,
          lastCheckedBlock: blockNumber,
          alertsSent: 0,
        };
      }

      const wasWorkable = jobInfo.isCurrentlyWorkable;
      const isWorkable = jobStatus.workable && !jobStatus.error;

      // Update job status
      jobInfo.isCurrentlyWorkable = isWorkable;
      jobInfo.lastCheckedBlock = blockNumber;

      if (isWorkable) {
        if (wasWorkable) {
          // Still workable - increment counter
          jobInfo.consecutiveWorkableBlocks++;
        } else {
          // Newly workable - reset counter
          jobInfo.consecutiveWorkableBlocks = 1;
        }

        // Check if we need to send an alert
        if (jobInfo.consecutiveWorkableBlocks >= config.alertThresholdBlocks) {
          const blocksSinceLastAlert = jobInfo.lastAlertBlock 
            ? blockNumber - jobInfo.lastAlertBlock 
            : Infinity;

          // Send alert if threshold reached and we haven't alerted recently
          if (blocksSinceLastAlert >= config.alertThresholdBlocks) {
            await this.sendAlert(jobInfo, blockNumber);
            jobInfo.alertsSent++;
            jobInfo.lastAlertBlock = blockNumber;
          }
        }
      } else {
        // Not workable - check if it was worked
        if (wasWorkable) {
          // Job was workable but now isn't - it might have been worked
          const wasWorked = await this.ethereum.checkWorkTransactionInBlock(
            jobStatus.address,
            blockNumber
          );

          if (wasWorked) {
            jobInfo.lastWorkedBlock = blockNumber;
            logger.info('Job was worked', {
              address: jobStatus.address,
              blockNumber,
              name: jobInfo.name,
            });
          }
        }

        // Reset workable counter
        jobInfo.consecutiveWorkableBlocks = 0;
      }

      // Save updated job info
      await this.database.upsertJob(jobInfo);

      monitorLogger.jobCheck(jobStatus.address, isWorkable, blockNumber);
    } catch (error) {
      logger.error('Error processing job status', {
        jobAddress: jobStatus.address,
        blockNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendAlert(jobInfo: JobInfo, blockNumber: number): Promise<void> {
    try {
      const alertData: AlertData = {
        jobAddress: jobInfo.address,
        jobName: jobInfo.name,
        consecutiveWorkableBlocks: jobInfo.consecutiveWorkableBlocks,
        currentBlock: blockNumber,
        threshold: config.alertThresholdBlocks,
        timestamp: Date.now(),
      };

      await this.discord.sendAlert(alertData);
      monitorLogger.jobAlert(
        jobInfo.address,
        jobInfo.consecutiveWorkableBlocks,
        config.alertThresholdBlocks
      );
    } catch (error) {
      logger.error('Failed to send alert', {
        jobAddress: jobInfo.address,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private getJobName(address: string): string {
    // Check known jobs first
    for (const [name, knownAddress] of Object.entries(KNOWN_JOBS)) {
      if (knownAddress.toLowerCase() === address.toLowerCase()) {
        return name;
      }
    }

    // Return short address if unknown
    return `Job ${address.slice(0, 8)}...`;
  }

  // Public methods for external control and monitoring
  async getStatus(): Promise<Record<string, unknown>> {
    const jobs = await this.database.getAllJobs();
    const workableJobs = jobs.filter(job => job.isCurrentlyWorkable);
    const criticalJobs = workableJobs.filter(job => 
      job.consecutiveWorkableBlocks >= config.alertThresholdBlocks
    );

    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      totalJobs: jobs.length,
      workableJobs: workableJobs.length,
      criticalJobs: criticalJobs.length,
      config: {
        alertThreshold: config.alertThresholdBlocks,
        checkInterval: config.checkIntervalSeconds,
      },
      jobs: jobs.map(job => ({
        address: job.address,
        name: job.name,
        isWorkable: job.isCurrentlyWorkable,
        consecutiveBlocks: job.consecutiveWorkableBlocks,
        alertsSent: job.alertsSent,
      })),
    };
  }

  async sendSummaryReport(): Promise<void> {
    const jobs = await this.database.getAllJobs();
    await this.discord.sendSummaryReport(jobs);
  }

  async forceCheck(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Monitoring service is not running');
    }

    logger.info('Forcing manual check...');
    await this.monitoringLoop();
  }
}