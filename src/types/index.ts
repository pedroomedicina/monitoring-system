export interface JobInfo {
  address: string;
  name?: string;
  description?: string;
  lastWorkedBlock?: number;
  consecutiveWorkableBlocks: number;
  isCurrentlyWorkable: boolean;
  lastCheckedBlock: number;
  alertsSent: number;
  lastAlertBlock?: number;
}

export interface BlockInfo {
  number: number;
  timestamp: number;
  hash: string;
}

export interface MonitoringConfig {
  sequencerAddress: string;
  alertThresholdBlocks: number;
  checkIntervalSeconds: number;
  maxBlocksPerQuery: number;
  ethereumRpcUrl: string;
  ethereumWsUrl?: string;
  discordWebhookUrl: string;
  databasePath: string;
  logLevel: string;
  logFile: string;
}

export interface AlertData {
  jobAddress: string;
  jobName?: string;
  consecutiveWorkableBlocks: number;
  currentBlock: number;
  threshold: number;
  timestamp: number;
}

export interface JobStatus {
  address: string;
  workable: boolean;
  blockNumber: number;
  error?: string;
}

export interface IJob {
  // The IJob interface from MakerDAO
  workable(): Promise<boolean>;
  work(): Promise<void>;
}

export interface SequencerInterface {
  numJobs(): Promise<number>;
  jobAt(index: number): Promise<string>;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  DEBUG = 'debug',
}

export interface DatabaseJob {
  address: string;
  name?: string;
  last_worked_block?: number;
  consecutive_workable_blocks: number;
  is_currently_workable: boolean;
  last_checked_block: number;
  alerts_sent: number;
  last_alert_block?: number;
  created_at: string;
  updated_at: string;
}