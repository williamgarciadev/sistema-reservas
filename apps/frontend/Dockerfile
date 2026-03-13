# Multi-stage Dockerfile for Frontend (Next.js 14)
# Production optimized with standalone output and caching

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies for build
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js with standalone output
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init tini

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package.json for standalone mode
COPY --from=builder /app/package.json ./

# Copy standalone output from .next/standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets
COPY --from=builder /app/public ./public

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "dumb-init", "--"]

# Start Next.js standalone server
CMD ["node", "server.js"]
