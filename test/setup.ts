// Test setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless DEBUG=true
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
process.env.SEQUENCER_ADDRESS = process.env.SEQUENCER_ADDRESS || '0x238b4E35dAed6100C6162fAE4510261f88996EC9';
process.env.DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/test';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || ':memory:';
process.env.ALERT_THRESHOLD_BLOCKS = process.env.ALERT_THRESHOLD_BLOCKS || '10';
process.env.CHECK_INTERVAL_SECONDS = process.env.CHECK_INTERVAL_SECONDS || '5';