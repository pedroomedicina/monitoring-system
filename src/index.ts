#!/usr/bin/env node

import { MonitoringService } from './services/monitor';
import { logger } from './utils/logger';
import { config } from './utils/config';

class Application {
  private monitoringService: MonitoringService;
  private isShuttingDown = false;

  constructor() {
    this.monitoringService = new MonitoringService();
    this.setupGracefulShutdown();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting MakerDAO Job Monitor...', {
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      });

      // Display configuration
      logger.info('Configuration loaded', {
        sequencerAddress: config.sequencerAddress,
        alertThreshold: config.alertThresholdBlocks,
        checkInterval: config.checkIntervalSeconds,
        databasePath: config.databasePath,
        logLevel: config.logLevel,
      });

      // Initialize and start monitoring
      await this.monitoringService.initialize();
      await this.monitoringService.start();

      logger.info('✅ MakerDAO Job Monitor is now running!');
      logger.info('📊 Use Ctrl+C to stop the monitor');

      // Send initial summary report
      setTimeout(async () => {
        try {
          await this.monitoringService.sendSummaryReport();
        } catch (error) {
          logger.warn('Failed to send initial summary report', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }, 5000); // Wait 5 seconds for initial data collection

    } catch (error) {
      logger.error('Failed to start application', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string): Promise<void> => {
      if (this.isShuttingDown) {
        logger.warn('Force shutdown requested');
        process.exit(1);
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}. Gracefully shutting down...`);

      try {
        await this.monitoringService.stop();
        logger.info('✅ Shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      
      if (!this.isShuttingDown) {
        shutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
      });
      
      if (!this.isShuttingDown) {
        shutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
      }
    });
  }
}

// CLI Interface for additional commands
async function handleCLICommands(): Promise<boolean> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return false; // No CLI commands, run normal monitoring
  }

  const command = args[0];

  try {
    const monitoringService = new MonitoringService();
    await monitoringService.initialize();

    switch (command) {
      case 'status':
        const status = await monitoringService.getStatus();
        console.log('\n📊 MakerDAO Job Monitor Status:');
        console.log('================================');
        console.log(`Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
        console.log(`Last Block: ${status.lastProcessedBlock}`);
        console.log(`Total Jobs: ${status.totalJobs}`);
        console.log(`Workable Jobs: ${status.workableJobs}`);
        console.log(`Critical Jobs: ${status.criticalJobs}`);
        
        const config = status.config as { alertThreshold: number; checkInterval: number };
        console.log(`Alert Threshold: ${config.alertThreshold} blocks`);
        console.log(`Check Interval: ${config.checkInterval} seconds`);
        
        if (Number(status.criticalJobs) > 0) {
          console.log('\n🚨 Critical Jobs:');
          const jobs = status.jobs as Array<{ name: string; address: string; consecutiveBlocks: number }>;
          jobs
            .filter(job => job.consecutiveBlocks >= config.alertThreshold)
            .forEach(job => {
              console.log(`  • ${job.name} (${job.address}): ${job.consecutiveBlocks} blocks`);
            });
        }
        console.log('');
        break;

      case 'check':
        console.log('🔍 Running manual check...');
        await monitoringService.forceCheck();
        console.log('✅ Manual check completed');
        break;

      case 'report':
        console.log('📊 Sending summary report to Discord...');
        await monitoringService.sendSummaryReport();
        console.log('✅ Summary report sent');
        break;

      case 'test':
        console.log('🧪 Testing Discord webhook...');
        const discord = new (await import('./services/discord')).DiscordService();
        const success = await discord.testWebhook();
        console.log(success ? '✅ Discord webhook test successful' : '❌ Discord webhook test failed');
        break;

      case 'help':
      case '--help':
      case '-h':
        console.log(`
🏗️  MakerDAO Job Monitor CLI

Usage: npm start [command]

Commands:
  (no command)    Start the monitoring service
  status          Show current monitor status
  check           Run a manual check of all jobs
  report          Send summary report to Discord
  test            Test Discord webhook connectivity
  help            Show this help message

Examples:
  npm start              # Start monitoring
  npm start status       # Check status
  npm start check        # Manual check
  npm start report       # Send report
  npm start test         # Test Discord
`);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Use "npm start help" for available commands');
        process.exit(1);
    }

    await monitoringService.stop();
    return true;
  } catch (error) {
    console.error('❌ Command failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Main execution
async function main(): Promise<void> {
  const isCliCommand = await handleCLICommands();
  
  if (!isCliCommand) {
    // No CLI command provided, start normal monitoring
    const app = new Application();
    await app.start();
  }
}

// Start the application
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});