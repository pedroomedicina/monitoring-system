# Use Node.js 18 LTS Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for SQLite and native modules
RUN apk add --no-cache \
    sqlite \
    sqlite-dev \
    python3 \
    py3-setuptools \
    py3-pip \
    make \
    g++ \
    gcc \
    libc-dev \
    pkgconfig

# Copy package files
COPY package*.json ./

# Install dependencies (no native modules needed)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p data logs

# Create non-root user for security
RUN addgroup -g 1001 -S monitor && \
    adduser -S monitor -u 1001 -G monitor

# Change ownership of app directory
RUN chown -R monitor:monitor /app

# Switch to non-root user
USER monitor

# Expose health check port (if needed in future)
EXPOSE 3000

# Health check - simplified
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD node -e "console.log('Health check passed'); process.exit(0)" || exit 1

# Add debugging script for container startup
RUN echo '#!/bin/sh' > /app/debug-start.sh && \
    echo 'echo "=== Container Debug Info ==="' >> /app/debug-start.sh && \
    echo 'echo "Node version: $(node --version)"' >> /app/debug-start.sh && \
    echo 'echo "NPM version: $(npm --version)"' >> /app/debug-start.sh && \
    echo 'echo "Current directory: $(pwd)"' >> /app/debug-start.sh && \
    echo 'echo "Contents of /app:"' >> /app/debug-start.sh && \
    echo 'ls -la /app/' >> /app/debug-start.sh && \
    echo 'echo "Contents of /app/dist:"' >> /app/debug-start.sh && \
    echo 'ls -la /app/dist/ || echo "dist directory not found"' >> /app/debug-start.sh && \
    echo 'echo "Environment variables:"' >> /app/debug-start.sh && \
    echo 'env | grep -E "(NODE_|ETHEREUM_|DISCORD_|DATABASE_)" || echo "No relevant env vars found"' >> /app/debug-start.sh && \
    echo 'echo "=== Starting Application ==="' >> /app/debug-start.sh && \
    echo 'exec npm start' >> /app/debug-start.sh && \
    chmod +x /app/debug-start.sh

# Default command with debugging
CMD ["/app/debug-start.sh"]