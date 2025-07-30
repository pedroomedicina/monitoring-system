import { loadConfig, validateConfig } from '../src/utils/config';
import { MonitoringConfig, LogLevel } from '../src/types';

describe('Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      // Set required environment variables
      process.env.ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/test';
      process.env.SEQUENCER_ADDRESS = '0x238b4E35dAed6100C6162fAE4510261f88996EC9';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
      process.env.ALERT_THRESHOLD_BLOCKS = '1000';
      process.env.CHECK_INTERVAL_SECONDS = '30';

      const config = loadConfig();

      expect(config.ethereumRpcUrl).toBe('https://mainnet.infura.io/v3/test');
      expect(config.sequencerAddress).toBe('0x238b4E35dAed6100C6162fAE4510261f88996EC9');
      expect(config.discordWebhookUrl).toBe('https://discord.com/api/webhooks/test');
      expect(config.alertThresholdBlocks).toBe(1000);
      expect(config.checkIntervalSeconds).toBe(30);
    });

    it('should use default values for optional variables', () => {
      // Set only required variables and clear optional ones
      process.env.ETHEREUM_RPC_URL = 'https://mainnet.infura.io/v3/test';
      process.env.SEQUENCER_ADDRESS = '0x238b4E35dAed6100C6162fAE4510261f88996EC9';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
      delete process.env.ALERT_THRESHOLD_BLOCKS;
      delete process.env.CHECK_INTERVAL_SECONDS;
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.alertThresholdBlocks).toBe(1000); // default
      expect(config.checkIntervalSeconds).toBe(30); // default
      expect(config.logLevel).toBe(LogLevel.INFO); // default
    });

    it('should throw error for missing required variables', () => {
      // Clear required variables
      delete process.env.ETHEREUM_RPC_URL;
      delete process.env.SEQUENCER_ADDRESS;
      delete process.env.DISCORD_WEBHOOK_URL;

      expect(() => loadConfig()).toThrow('Required environment variable ETHEREUM_RPC_URL is not set');
    });
  });

  describe('validateConfig', () => {
    let validConfig: MonitoringConfig;

    beforeEach(() => {
      validConfig = {
        ethereumRpcUrl: 'https://mainnet.infura.io/v3/test',
        sequencerAddress: '0x238b4E35dAed6100C6162fAE4510261f88996EC9',
        discordWebhookUrl: 'https://discord.com/api/webhooks/123/test',
        alertThresholdBlocks: 1000,
        checkIntervalSeconds: 30,
        maxBlocksPerQuery: 100,
        databasePath: './data/test.db',
        logLevel: LogLevel.INFO,
        logFile: './logs/test.log',
      };
    });

    it('should pass validation for valid config', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should throw error for invalid RPC URL', () => {
      validConfig.ethereumRpcUrl = 'invalid-url';
      expect(() => validateConfig(validConfig)).toThrow('ETHEREUM_RPC_URL must start with http or https');
    });

    it('should throw error for invalid Ethereum address', () => {
      validConfig.sequencerAddress = 'invalid-address';
      expect(() => validateConfig(validConfig)).toThrow('SEQUENCER_ADDRESS must be a valid Ethereum address');
    });

    it('should throw error for invalid Discord webhook URL', () => {
      validConfig.discordWebhookUrl = 'https://example.com/webhook';
      expect(() => validateConfig(validConfig)).toThrow('DISCORD_WEBHOOK_URL must be a valid Discord webhook URL');
    });

    it('should throw error for invalid alert threshold', () => {
      validConfig.alertThresholdBlocks = 0;
      expect(() => validateConfig(validConfig)).toThrow('ALERT_THRESHOLD_BLOCKS must be a positive number');
    });

    it('should throw error for invalid check interval', () => {
      validConfig.checkIntervalSeconds = -1;
      expect(() => validateConfig(validConfig)).toThrow('CHECK_INTERVAL_SECONDS must be a positive number');
    });

    it('should throw error for invalid max blocks per query', () => {
      validConfig.maxBlocksPerQuery = 2000;
      expect(() => validateConfig(validConfig)).toThrow('MAX_BLOCKS_PER_QUERY must be between 1 and 1000');
    });

    it('should throw error for invalid log level', () => {
      validConfig.logLevel = 'invalid' as LogLevel;
      expect(() => validateConfig(validConfig)).toThrow('LOG_LEVEL must be one of: error, warn, info, debug');
    });
  });
});