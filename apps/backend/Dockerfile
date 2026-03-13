# Multi-stage Dockerfile for Backend (Express + Prisma)
# Production optimized with security best practices

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

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install security updates and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init tini

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built files from builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
