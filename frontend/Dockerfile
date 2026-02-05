# ============================================================================
# STAGE 1: DEPENDENCIES
# ============================================================================
FROM node:22-alpine AS deps

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm ci --legacy-peer-deps


# ============================================================================
# STAGE 2: BUILDER
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ============================================================================
# STAGE 3: RUNNER (Production)
# ============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libc6-compat

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Install prisma CLI for database migrations at runtime
RUN npm install -g prisma@7.2.0

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create directory for database and set permissions
RUN mkdir -p /app/prisma && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Use entrypoint to initialize DB before starting
CMD ["./docker-entrypoint.sh"]
