# ─────────────────────────────────────────────
# Stage 1: Dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only manifest files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# ─────────────────────────────────────────────
# Stage 2: Production image
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Set NODE_ENV so Express and other libs behave in production mode
ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package*.json ./

# Own all files by the non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose the port the Express server listens on
EXPOSE 5000

# Healthcheck so Docker / orchestrators know when the service is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/v1/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
