import { AlertData, JobInfo } from '../types';
import { logger, monitorLogger } from '../utils/logger';
import { config } from '../utils/config';
import { JOB_DESCRIPTIONS } from '../contracts/sequencer';

export class DiscordService {
  private webhookUrl: string;

  constructor(webhookUrl: string = config.discordWebhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(alertData: AlertData): Promise<boolean> {
    try {
      const embed = this.createAlertEmbed(alertData);
      const payload = {
        content: '🚨 **MakerDAO Job Alert** 🚨',
        embeds: [embed],
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      monitorLogger.discordAlert(alertData.jobAddress, true);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      monitorLogger.discordAlert(alertData.jobAddress, false, errorMessage);
      return false;
    }
  }

  async sendSummaryReport(jobs: JobInfo[]): Promise<boolean> {
    try {
      const workableJobs = jobs.filter(job => job.isCurrentlyWorkable);
      const criticalJobs = workableJobs.filter(job => 
        job.consecutiveWorkableBlocks >= config.alertThresholdBlocks
      );

      const embed = {
        title: '📊 MakerDAO Jobs Summary Report',
        color: criticalJobs.length > 0 ? 0xff6b6b : 0x51cf66, // Red if critical jobs, green otherwise
        description: `Monitoring ${jobs.length} total jobs`,
        fields: [
          {
            name: '🟢 Total Jobs',
            value: jobs.length.toString(),
            inline: true,
          },
          {
            name: '🟡 Workable Jobs',
            value: workableJobs.length.toString(),
            inline: true,
          },
          {
            name: '🔴 Critical Jobs',
            value: criticalJobs.length.toString(),
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'MakerDAO Job Monitor',
        },
      };

      // Add critical jobs details
      if (criticalJobs.length > 0) {
        const criticalJobsList = criticalJobs
          .slice(0, 5) // Limit to 5 jobs to avoid message length limits
          .map(job => {
            const name = job.name || `Job ${job.address.slice(0, 8)}...`;
            return `• **${name}**: ${job.consecutiveWorkableBlocks} blocks`;
          })
          .join('\n');

        embed.fields.push({
          name: '⚠️ Critical Jobs Details',
          value: criticalJobsList,
          inline: false,
        });
      }

      const payload = {
        embeds: [embed],
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Summary report sent to Discord', { 
        totalJobs: jobs.length,
        workableJobs: workableJobs.length,
        criticalJobs: criticalJobs.length 
      });
      return true;
    } catch (error) {
      logger.error('Failed to send summary report', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  private createAlertEmbed(alertData: AlertData): Record<string, unknown> {
    const jobName = alertData.jobName || JOB_DESCRIPTIONS[alertData.jobAddress] || 'Unknown Job';
    const shortAddress = `${alertData.jobAddress.slice(0, 6)}...${alertData.jobAddress.slice(-4)}`;
    
    // Calculate urgency level
    const urgencyRatio = alertData.consecutiveWorkableBlocks / alertData.threshold;
    let urgencyLevel = '🟡 Medium';
    let color = 0xffd93d; // Yellow

    if (urgencyRatio >= 2) {
      urgencyLevel = '🔴 Critical';
      color = 0xff6b6b; // Red
    } else if (urgencyRatio >= 1.5) {
      urgencyLevel = '🟠 High';
      color = 0xff8e53; // Orange
    }

    return {
      title: `${urgencyLevel} - MakerDAO Job Needs Attention`,
      color: color,
      description: `Job has been workable for **${alertData.consecutiveWorkableBlocks}** consecutive blocks!`,
      fields: [
        {
          name: '📋 Job Details',
          value: `**Name:** ${jobName}\n**Address:** \`${alertData.jobAddress}\`\n**Short:** ${shortAddress}`,
          inline: true,
        },
        {
          name: '📊 Statistics',
          value: `**Workable Blocks:** ${alertData.consecutiveWorkableBlocks}\n**Threshold:** ${alertData.threshold}\n**Current Block:** ${alertData.currentBlock}`,
          inline: true,
        },
        {
          name: '🔗 Quick Links',
          value: `[Etherscan](https://etherscan.io/address/${alertData.jobAddress}) | [View Code](https://etherscan.io/address/${alertData.jobAddress}#code)`,
          inline: false,
        },
      ],
      timestamp: new Date(alertData.timestamp).toISOString(),
      footer: {
        text: 'MakerDAO Job Monitor • Keep the protocol running smoothly',
        icon_url: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
    };
  }

  async testWebhook(): Promise<boolean> {
    try {
      const testPayload = {
        content: '✅ MakerDAO Job Monitor - Test message',
        embeds: [{
          title: '🧪 System Test',
          description: 'This is a test message to verify Discord webhook connectivity.',
          color: 0x51cf66,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'MakerDAO Job Monitor',
          },
        }],
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Discord webhook test successful');
      return true;
    } catch (error) {
      logger.error('Discord webhook test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}