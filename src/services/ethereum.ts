import { ethers } from 'ethers';
import { SEQUENCER_ABI, JOB_ABI } from '../contracts/sequencer';
import { JobStatus, BlockInfo } from '../types';
import { logger, monitorLogger } from '../utils/logger';
import { config } from '../utils/config';

export class EthereumService {
  private provider: ethers.Provider;
  private sequencerContract: ethers.Contract;
  private wsProvider?: ethers.WebSocketProvider;

  constructor() {
    // Initialize HTTP provider for general queries
    this.provider = new ethers.JsonRpcProvider(config.ethereumRpcUrl);
    
    // Initialize WebSocket provider for real-time events (if configured)
    if (config.ethereumWsUrl) {
      try {
        this.wsProvider = new ethers.WebSocketProvider(config.ethereumWsUrl);
        logger.info('WebSocket provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize WebSocket provider', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Initialize Sequencer contract
    this.sequencerContract = new ethers.Contract(
      config.sequencerAddress,
      SEQUENCER_ABI,
      this.provider
    );

    logger.info('Ethereum service initialized', {
      rpcUrl: config.ethereumRpcUrl,
      sequencerAddress: config.sequencerAddress,
      hasWebSocket: !!this.wsProvider,
    });
  }

  async getLatestBlock(): Promise<BlockInfo> {
    try {
      const block = await this.provider.getBlock('latest');
      if (!block) {
        throw new Error('Failed to get latest block');
      }

      return {
        number: block.number,
        timestamp: block.timestamp,
        hash: block.hash || `pending-${block.number}`,
      };
    } catch (error) {
      monitorLogger.rpcError('getBlock', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getBlock(blockNumber: number): Promise<BlockInfo> {
    try {
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        throw new Error(`Block ${blockNumber} not found`);
      }

      return {
        number: block.number,
        timestamp: block.timestamp,
        hash: block.hash || `pending-${block.number}`,
      };
    } catch (error) {
      monitorLogger.rpcError('getBlock', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getJobCount(): Promise<number> {
    try {
      const count = await this.sequencerContract.numJobs();
      return Number(count);
    } catch (error) {
      monitorLogger.rpcError('numJobs', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getJobAddress(index: number): Promise<string> {
    try {
      const address = await this.sequencerContract.jobAt(index);
      return address;
    } catch (error) {
      monitorLogger.rpcError('jobAt', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getAllJobAddresses(): Promise<string[]> {
    try {
      const jobCount = await this.getJobCount();
      const addresses: string[] = [];

      // Batch requests for efficiency
      const promises: Promise<string>[] = [];
      for (let i = 0; i < jobCount; i++) {
        promises.push(this.getJobAddress(i));
      }

      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          addresses.push(result.value);
        } else {
          logger.warn(`Failed to get job address at index ${index}`, { 
            error: result.reason 
          });
        }
      });

      logger.info('Retrieved job addresses', { 
        totalJobs: jobCount, 
        successfullyRetrieved: addresses.length 
      });

      return addresses;
    } catch (error) {
      logger.error('Failed to get all job addresses', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  async checkJobWorkable(jobAddress: string, blockNumber?: number): Promise<JobStatus> {
    try {
      const jobContract = new ethers.Contract(jobAddress, JOB_ABI, this.provider);
      
      // Use specific block if provided, otherwise use latest
      const overrides = blockNumber ? { blockTag: blockNumber } : {};
      
      const workable = await jobContract.workable(overrides);
      
      return {
        address: jobAddress,
        workable: Boolean(workable),
        blockNumber: blockNumber || (await this.getLatestBlock()).number,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if it's a rate limiting error - throw to trigger retry logic
      if (errorMessage.toLowerCase().includes('too many requests') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('429')) {
        monitorLogger.rpcError('workable', `Rate limited: ${errorMessage}`);
        throw error; // Re-throw rate limiting errors for retry logic
      }
      
      // For other errors, log and return error result
      monitorLogger.rpcError('workable', errorMessage);
      
      return {
        address: jobAddress,
        workable: false,
        blockNumber: blockNumber || 0,
        error: errorMessage,
      };
    }
  }

  async checkMultipleJobsWorkable(
    jobAddresses: string[], 
    blockNumber?: number
  ): Promise<JobStatus[]> {
    const promises = jobAddresses.map(address => 
      this.checkJobWorkable(address, blockNumber)
    );

    const results = await Promise.allSettled(promises);
    
    // Check if any failures are rate limiting errors - if so, re-throw to trigger retry logic
    const rateLimitingErrors = results.filter((result, index) => {
      if (result.status === 'rejected' && result.reason instanceof Error) {
        const errorMessage = result.reason.message.toLowerCase();
        return errorMessage.includes('too many requests') || 
               errorMessage.includes('rate limit') || 
               errorMessage.includes('429');
      }
      return false;
    });

    if (rateLimitingErrors.length > 0) {
      // Re-throw the first rate limiting error to trigger retry logic
      const firstError = rateLimitingErrors[0] as PromiseRejectedResult;
      throw firstError.reason;
    }
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          address: jobAddresses[index],
          workable: false,
          blockNumber: blockNumber || 0,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  }

  async estimateGasForWork(jobAddress: string): Promise<bigint | null> {
    try {
      const jobContract = new ethers.Contract(jobAddress, JOB_ABI, this.provider);
      const gasEstimate = await jobContract.work.estimateGas();
      return gasEstimate;
    } catch (error) {
      logger.debug('Failed to estimate gas for work', { 
        jobAddress, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  // Utility method to check if a transaction executed the work function
  async checkWorkTransactionInBlock(
    jobAddress: string, 
    blockNumber: number
  ): Promise<boolean> {
    try {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        return false;
      }

      // Look for transactions that called the work() function on this job
      for (const txHash of block.transactions) {
        try {
          const tx = await this.provider.getTransaction(txHash);
          if (!tx) continue;

          // Check if transaction is to our job address
          if (tx.to?.toLowerCase() === jobAddress.toLowerCase()) {
            // Check if data starts with work function selector (0x26b6308e)
            if (tx.data.startsWith('0x26b6308e')) {
              // Get transaction receipt to ensure it was successful
              const receipt = await this.provider.getTransactionReceipt(txHash);
              if (receipt && receipt.status === 1) {
                return true;
              }
            }
          }
        } catch {
          // Continue checking other transactions
          continue;
        }
      }

      return false;
    } catch (error) {
      logger.debug('Failed to check work transaction in block', { 
        jobAddress, 
        blockNumber, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  // Subscribe to new blocks (requires WebSocket)
  onNewBlock(callback: (blockNumber: number) => void): () => void {
    if (!this.wsProvider) {
      throw new Error('WebSocket provider not available for block subscriptions');
    }

    this.wsProvider.on('block', callback);
    
    // Return unsubscribe function
    return (): void => {
      this.wsProvider?.off('block', callback);
    };
  }

  async disconnect(): Promise<void> {
    try {
      if (this.wsProvider) {
        await this.wsProvider.destroy();
        logger.info('WebSocket provider disconnected');
      }
      logger.info('Ethereum service disconnected');
    } catch (error) {
      logger.error('Error disconnecting Ethereum service', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const latestBlock = await this.getLatestBlock();
      const jobCount = await this.getJobCount();
      
      logger.debug('Ethereum service health check passed', {
        latestBlock: latestBlock.number,
        jobCount,
      });
      
      return true;
    } catch (error) {
      logger.error('Ethereum service health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}