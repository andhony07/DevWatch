/**
 * @fileoverview Application entry point and server bootstrap.
 *
 * Boot sequence:
 *   1. Config is loaded first (env.js) — validates all environment variables
 *   2. Logger is initialized
 *   3. MongoDB connection is established with retry
 *   4. HTTP server is created from the Express app
 *   5. Socket.IO is attached to the HTTP server
 *   6. Server begins listening on the configured port
 *   7. Startup banner is displayed
 *   8. Registered API routes are logged
 *
 * Graceful shutdown handles:
 *   - SIGINT  (Ctrl+C in terminal)
 *   - SIGTERM (sent by Docker / Kubernetes / PM2)
 *   - unhandledRejection
 *   - uncaughtException
 */

// ── Config must be the very first import ──────────────────────────────────────
import { config } from './config/env.js';

import { createServer } from 'http';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './database/mongo.js';
import { app } from './app.js';
import { initializeSocket } from './sockets/socket.js';
import { displayBanner } from './utils/banner.js';
import { logRegisteredRoutes } from './routes/index.js';
import { MESSAGES } from './constants/messages.js';

/** @type {import('http').Server | null} */
let httpServer = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/**
 * Bootstraps and starts the DevWatch backend server.
 * Each step is clearly logged. Any failure triggers a clean process exit.
 *
 * @returns {Promise<void>}
 */
const bootstrap = async () => {
  try {
    // Step 1 — Connect to MongoDB
    await connectDatabase();

    // Step 2 — Create HTTP server from Express app
    httpServer = createServer(app);

    // Step 3 — Attach Socket.IO to the HTTP server
    initializeSocket(httpServer);

    // Step 4 — Begin listening
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(config.port, () => {
        httpServer.removeListener('error', reject);
        resolve();
      });
    });

    // Step 5 — Display startup banner
    displayBanner({
      port: config.port,
      environment: config.nodeEnv,
      mongoUri: config.mongoUri,
    });

    // Step 6 — Log all registered routes
    logRegisteredRoutes('/v1');

    logger.info(`${MESSAGES.SERVER.STARTED} Listening on port ${config.port}.`);
  } catch (error) {
    logger.error('Fatal: failed to start the server.', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

/**
 * Cleanly shuts down the HTTP server and MongoDB before exiting.
 * Called on SIGINT and SIGTERM.
 *
 * @param {string} signal - The signal name that triggered shutdown
 * @returns {Promise<void>}
 */
const gracefulShutdown = async (signal) => {
  logger.warn(`${signal} received. ${MESSAGES.SERVER.SHUTDOWN}`);

  // Close HTTP server (stop accepting new requests)
  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
  }

  // Disconnect from MongoDB
  await disconnectDatabase();

  logger.info(MESSAGES.SERVER.GRACEFUL_SHUTDOWN);
  process.exit(0);
};

// ── Process Signal Handlers ───────────────────────────────────────────────────

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Unhandled promise rejection — log and exit so the process manager can restart.
 * Never silently swallow unhandled rejections.
 */
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection — terminating.', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

/**
 * Uncaught synchronous exception — the process state is unreliable, exit immediately.
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception — terminating.', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────
bootstrap();
