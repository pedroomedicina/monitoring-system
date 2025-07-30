# MakerDAO Job Monitor

A robust monitoring system for MakerDAO automation jobs that sends Discord alerts when jobs haven't been executed for too many consecutive blocks.

## 🎯 Challenge Overview

This project implements **Option 2** from the Wonderland challenge:
- **Long-running NodeJS process** using TypeScript
- **Discord alerts** when jobs haven't been worked for 1000+ consecutive blocks
- **Docker deployment** ready
- **Comprehensive monitoring** of all MakerDAO Sequencer jobs

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ethereum      │    │   Monitoring     │    │   Discord       │
│   Mainnet       │◄──►│   Service        │───►│   Alerts        │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   SQLite        │
                       │   Database      │
                       └─────────────────┘
```

### Core Components

- **EthereumService**: Interacts with the Sequencer contract and individual jobs
- **MonitoringService**: Orchestrates job checking and alert logic
- **DiscordService**: Sends rich embeds to Discord webhooks
- **SQLiteDatabase**: Persists job state and monitoring history
- **Logger**: Structured logging with Winston

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Ethereum RPC endpoint (Infura, Alchemy, etc.)
- Discord webhook URL

### Installation

1. **Clone and install dependencies:**
```bash
cd /Users/pedro/Documents/projects/wonderland/monitoring-system
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required environment variables:**
```env
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
SEQUENCER_ADDRESS=0x238b4E35dAed6100C6162fAE4510261f88996EC9
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

4. **Build and run:**
```bash
npm run build
npm start
```

## 📋 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ETHEREUM_RPC_URL` | ✅ | - | Ethereum mainnet RPC endpoint |
| `ETHEREUM_WS_URL` | ❌ | - | WebSocket RPC for real-time events |
| `SEQUENCER_ADDRESS` | ✅ | - | MakerDAO Sequencer contract address |
| `DISCORD_WEBHOOK_URL` | ✅ | - | Discord webhook for alerts |
| `ALERT_THRESHOLD_BLOCKS` | ❌ | 1000 | Blocks before triggering alert |
| `CHECK_INTERVAL_SECONDS` | ❌ | 30 | How often to check jobs |
| `MAX_BLOCKS_PER_QUERY` | ❌ | 100 | Max blocks to query at once |
| `DATABASE_PATH` | ❌ | ./data/monitoring.db | SQLite database location |
| `LOG_LEVEL` | ❌ | info | Logging level (error/warn/info/debug) |
| `LOG_FILE` | ❌ | ./logs/monitor.log | Log file location |

### Monitored Jobs

The system automatically discovers and monitors all jobs from the Sequencer contract:

- **AutoLineJob**: Debt ceiling adjustments
- **LerpJob**: Linear interpolation parameter changes  
- **D3MJob**: Direct Deposit Dai Module operations
- **ClipperMomJob**: Emergency circuit breaker for auctions
- **OracleJob**: Price feed updates and oracle maintenance
- **FlapJob**: Surplus auction management

## 🔧 CLI Commands

```bash
# Start monitoring (default)
npm start

# Check current status
npm start status

# Run manual check
npm start check

# Send summary report to Discord
npm start report

# Test Discord webhook
npm start test

# Show help
npm start help
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker directly

```bash
# Build image
docker build -t makerdao-monitor .

# Run container
docker run -d \
  --name makerdao-monitor \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  makerdao-monitor
```

## 📊 Monitoring Features

### Alert Types

1. **Job Alerts**: When a job is workable for 1000+ consecutive blocks
2. **Summary Reports**: Periodic status updates 
3. **Error Alerts**: System health and connectivity issues

### Alert Information

Each alert includes:
- Job name and address
- Consecutive workable blocks
- Urgency level (Medium/High/Critical)
- Direct links to Etherscan
- Historical context

### Example Alert

```
🔴 Critical - MakerDAO Job Needs Attention

Job has been workable for 1,250 consecutive blocks!

📋 Job Details
Name: AutoLineJob
Address: 0x67AD4000e73579B9725eE3A149F85C4Af0A61361

📊 Statistics  
Workable Blocks: 1,250
Threshold: 1,000
Current Block: 18,542,150

🔗 Quick Links
Etherscan | View Code
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Test Coverage

- Configuration validation
- Database operations (CRUD)
- Contract interaction mocking
- Discord webhook testing
- Monitoring logic verification

## 📈 Performance Optimizations

### Efficient RPC Usage

- **Batch Requests**: Check multiple jobs simultaneously
- **Block Caching**: Avoid redundant block queries
- **Smart Retry**: Exponential backoff for failed requests
- **Connection Pooling**: Reuse HTTP connections

### Memory Management

- **SQLite**: Lightweight, embedded database
- **Streaming Logs**: Rotating log files prevent disk overflow
- **Garbage Collection**: Proper cleanup of event listeners

### Rate Limiting

- **Configurable Intervals**: Adjust based on RPC provider limits
- **Adaptive Querying**: Reduce frequency during high gas periods
- **Graceful Degradation**: Continue operating with limited data

## 🛠️ Development

### Project Structure

```
src/
├── contracts/       # Contract ABIs and addresses
├── database/        # SQLite database service
├── services/        # Core business logic
│   ├── ethereum.ts  # Blockchain interactions
│   ├── discord.ts   # Alert notifications
│   └── monitor.ts   # Main monitoring orchestration
├── types/          # TypeScript type definitions
├── utils/          # Configuration and logging
└── index.ts        # Application entry point

test/               # Test suites
docker/             # Docker configuration
```

### Adding New Features

1. **New Job Types**: Add to `KNOWN_JOBS` in `sequencer.ts`
2. **Custom Alerts**: Extend `DiscordService.createAlertEmbed()`
3. **Metrics**: Add to monitoring loop in `MonitoringService`
4. **Health Checks**: Extend `EthereumService.healthCheck()`

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Run with Node.js inspector
node --inspect dist/index.js

# View database contents
sqlite3 data/monitoring.db ".tables"
sqlite3 data/monitoring.db "SELECT * FROM jobs;"
```

## 📚 Technical Specifications

### Contract Requirements

✅ **Must use `numJobs()` and `jobAt(index)`** - Primary job discovery  
✅ **Check `workable()` function** - Job status monitoring  
✅ **Track consecutive blocks** - Alert threshold logic  
✅ **Never query 1000+ blocks** - Initial bootstrap only  
✅ **TypeScript implementation** - Type safety and maintainability  

### Challenge Compliance

- **Long-running Process**: ✅ Continuous monitoring with proper lifecycle
- **1000 Block Threshold**: ✅ Configurable alert threshold 
- **Discord Integration**: ✅ Rich embeds with job details
- **Docker Deployment**: ✅ Production-ready containerization
- **Error Handling**: ✅ Graceful degradation and recovery
- **Documentation**: ✅ Comprehensive setup and usage guide

## 🚨 Troubleshooting

### Common Issues

**"Required environment variable not set"**
- Ensure all required variables are in `.env`
- Check `.env.example` for reference

**"Failed to connect to database"**
- Verify write permissions to data directory
- Check disk space availability

**"Discord webhook test failed"**
- Validate webhook URL format
- Ensure webhook has proper permissions

**"RPC call failed"**
- Check Ethereum RPC endpoint status
- Verify network connectivity
- Consider rate limiting

### Health Monitoring

```bash
# Check system status
npm start status

# View recent logs
tail -f logs/monitor.log

# Test all connections
npm start test
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 🔗 Links

- [MakerDAO Sequencer Contract](https://etherscan.io/address/0x238b4E35dAed6100C6162fAE4510261f88996EC9)
- [dss-cron Documentation](https://github.com/makerdao/dss-cron)
- [Wonderland Technology](https://defi.sucks/)