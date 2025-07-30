import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from './config';

// Ensure log directory exists
const logDir = path.dirname(config.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for blockchain monitoring
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  format: customFormat,
  defaultMeta: { service: 'makerdao-monitor' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: config.logFile,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }),
  ],
});

// Specific logging functions for different types of events
export const monitorLogger = {
  jobCheck: (jobAddress: string, workable: boolean, blockNumber: number): void => {
    logger.debug('Job check completed', { 
      jobAddress, 
      workable, 
      blockNumber,
      type: 'job_check' 
    });
  },

  jobAlert: (jobAddress: string, consecutiveBlocks: number, threshold: number): void => {
    logger.warn('Job alert triggered', { 
      jobAddress, 
      consecutiveBlocks, 
      threshold,
      type: 'job_alert' 
    });
  },

  blockProcessed: (blockNumber: number, jobsChecked: number): void => {
    logger.info('Block processed', { 
      blockNumber, 
      jobsChecked,
      type: 'block_processed' 
    });
  },

  discordAlert: (jobAddress: string, success: boolean, error?: string): void => {
    if (success) {
      logger.info('Discord alert sent successfully', { 
        jobAddress,
        type: 'discord_success' 
      });
    } else {
      logger.error('Failed to send Discord alert', { 
        jobAddress, 
        error,
        type: 'discord_error' 
      });
    }
  },

  rpcError: (method: string, error: string): void => {
    logger.error('RPC call failed', { 
      method, 
      error,
      type: 'rpc_error' 
    });
  },

  startup: (config: Record<string, unknown>): void => {
    logger.info('Monitor starting up', { 
      sequencerAddress: config.sequencerAddress,
      alertThreshold: config.alertThresholdBlocks,
      checkInterval: config.checkIntervalSeconds,
      type: 'startup' 
    });
  },

  shutdown: (): void => {
    logger.info('Monitor shutting down', { type: 'shutdown' });
  },
};