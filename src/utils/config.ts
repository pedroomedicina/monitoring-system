import dotenv from 'dotenv';
import { MonitoringConfig, LogLevel } from '../types';

// Load environment variables
dotenv.config();

export function loadConfig(): MonitoringConfig {
  const requiredEnvVars = [
    'ETHEREUM_RPC_URL',
    'SEQUENCER_ADDRESS', 
    'DISCORD_WEBHOOK_URL'
  ];

  // Check for required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  return {
    sequencerAddress: process.env.SEQUENCER_ADDRESS!,
    alertThresholdBlocks: parseInt(process.env.ALERT_THRESHOLD_BLOCKS || '1000'),
    checkIntervalSeconds: parseInt(process.env.CHECK_INTERVAL_SECONDS || '30'),
    maxBlocksPerQuery: parseInt(process.env.MAX_BLOCKS_PER_QUERY || '100'),
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL!,
    ethereumWsUrl: process.env.ETHEREUM_WS_URL,
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL!,
    databasePath: process.env.DATABASE_PATH || './data/monitoring.db',
    logLevel: process.env.LOG_LEVEL || LogLevel.INFO,
    logFile: process.env.LOG_FILE || './logs/monitor.log',
  };
}

export function validateConfig(config: MonitoringConfig): void {
  // Validate Ethereum RPC URL
  if (!config.ethereumRpcUrl.startsWith('http')) {
    throw new Error('ETHEREUM_RPC_URL must start with http or https');
  }

  // Validate Sequencer address format
  if (!config.sequencerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error('SEQUENCER_ADDRESS must be a valid Ethereum address');
  }

  // Validate Discord webhook URL
  if (!config.discordWebhookUrl.includes('discord.com/api/webhooks/')) {
    throw new Error('DISCORD_WEBHOOK_URL must be a valid Discord webhook URL');
  }

  // Validate numeric values
  if (config.alertThresholdBlocks <= 0) {
    throw new Error('ALERT_THRESHOLD_BLOCKS must be a positive number');
  }

  if (config.checkIntervalSeconds <= 0) {
    throw new Error('CHECK_INTERVAL_SECONDS must be a positive number');  
  }

  if (config.maxBlocksPerQuery <= 0 || config.maxBlocksPerQuery > 1000) {
    throw new Error('MAX_BLOCKS_PER_QUERY must be between 1 and 1000');
  }

  // Validate log level
  if (!Object.values(LogLevel).includes(config.logLevel as LogLevel)) {
    throw new Error('LOG_LEVEL must be one of: error, warn, info, debug');
  }
}

export const config = loadConfig();
validateConfig(config);