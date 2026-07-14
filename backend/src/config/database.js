/**
 * @fileoverview MongoDB connection manager.
 *
 * Features:
 *   - Exponential backoff retry strategy (up to MAX_RETRIES attempts)
 *   - Mongoose lifecycle event listeners (connected, disconnected, error, reconnected)
 *   - Graceful disconnect helper for shutdown sequences
 *   - Connection status reporter for health checks
 */

import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from './logger.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { sleep } from '../utils/helpers.js';

const { MONGO } = APP_CONSTANTS;

/** Tracks the current number of connection retry attempts. */
let retryCount = 0;

// ── Lifecycle Events ──────────────────────────────────────────────────────────

mongoose.connection.on('connected', () => {
  retryCount = 0;
  logger.info(MESSAGES.DATABASE.CONNECTED, {
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    dbName: mongoose.connection.name,
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn(MESSAGES.DATABASE.DISCONNECTED);
});

mongoose.connection.on('reconnected', () => {
  logger.info(MESSAGES.DATABASE.RECONNECTED);
});

mongoose.connection.on('error', (error) => {
  logger.error(MESSAGES.DATABASE.CONNECTION_ERROR, {
    error: error.message,
  });
});

// ── Connection ────────────────────────────────────────────────────────────────

/**
 * Attempts a single Mongoose connection.
 * On failure, waits with linear backoff and recurses until MAX_RETRIES is reached.
 *
 * @returns {Promise<void>}
 */
const attemptConnection = async () => {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: MONGO.SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: MONGO.SOCKET_TIMEOUT_MS,
      heartbeatFrequencyMS: MONGO.HEARTBEAT_FREQUENCY_MS,
    });
  } catch (error) {
    retryCount += 1;

    if (retryCount <= MONGO.MAX_RETRIES) {
      const delayMs = MONGO.RETRY_DELAY_MS * retryCount;
      logger.warn(
        `${MESSAGES.DATABASE.RECONNECTING} Attempt ${retryCount}/${MONGO.MAX_RETRIES}. Retrying in ${delayMs / 1000}s...`,
        { error: error.message }
      );
      await sleep(delayMs);
      return attemptConnection();
    }

    logger.error(`MongoDB connection failed after ${MONGO.MAX_RETRIES} attempts. Shutting down.`, {
      error: error.message,
    });
    process.exit(1);
  }
};

/**
 * Establishes a connection to MongoDB.
 * Should be called once during server bootstrap before starting the HTTP listener.
 *
 * @returns {Promise<void>}
 */
export const connectDatabase = async () => {
  logger.info('Connecting to MongoDB...', {
    uri: config.mongoUri.replace(/:\/\/([^:@]+):([^@]+)@/, '://**:**@'),
  });
  await attemptConnection();
};

// ── Disconnect ────────────────────────────────────────────────────────────────

/**
 * Gracefully closes the MongoDB connection.
 * Called during SIGINT/SIGTERM graceful shutdown sequences.
 *
 * @returns {Promise<void>}
 */
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info(MESSAGES.DATABASE.DISCONNECTED);
  }
};

// ── Status ────────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable label for the current Mongoose connection state.
 *
 * @returns {'disconnected'|'connected'|'connecting'|'disconnecting'|'unknown'}
 */
export const getDatabaseStatus = () => {
  const STATE_MAP = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return STATE_MAP[mongoose.connection.readyState] ?? 'unknown';
};
