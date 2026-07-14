/**
 * @fileoverview Winston logger configuration.
 *
 * Transports:
 *   - Console: colorized, human-readable output (development) or structured JSON (production)
 *   - Combined: daily-rotating JSON file for all log levels
 *   - Error: daily-rotating JSON file for error-level logs only
 *
 * Log files are written to: <backend_root>/logs/
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const { createLogger, format, transports } = winston;
const { combine, timestamp, colorize, printf, json, errors, splat } = format;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the logs root (backend/logs/) */
const LOG_DIR = path.resolve(__dirname, '../../logs');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

// ── Formats ───────────────────────────────────────────────────────────────────

/**
 * Human-readable console format with timestamp, level, and optional stack trace.
 */
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ timestamp: ts, level, message, stack, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return stack
      ? `[${ts}] ${level}: ${message}\n${stack}${metaStr}`
      : `[${ts}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * Structured JSON format for file transports and production console.
 */
const jsonFileFormat = combine(
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  errors({ stack: true }),
  splat(),
  json()
);

// ── Transports ────────────────────────────────────────────────────────────────

/**
 * Daily rotating combined log (all levels).
 * @type {DailyRotateFile}
 */
const combinedFileTransport = new DailyRotateFile({
  dirname: `${LOG_DIR}/combined`,
  filename: 'devwatch-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFileFormat,
  level: LOG_LEVEL,
  handleExceptions: false,
  handleRejections: false,
});

/**
 * Daily rotating error-only log.
 * @type {DailyRotateFile}
 */
const errorFileTransport = new DailyRotateFile({
  dirname: `${LOG_DIR}/errors`,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: jsonFileFormat,
  level: 'error',
  handleExceptions: false,
  handleRejections: false,
});

/**
 * Console transport — verbose in dev, warn-only JSON in production.
 * @type {winston.transports.ConsoleTransportInstance}
 */
const consoleTransport = IS_PRODUCTION
  ? new transports.Console({
      format: combine(timestamp(), json()),
      level: 'warn',
    })
  : new transports.Console({
      format: consoleFormat,
    });

// ── Logger Instance ───────────────────────────────────────────────────────────

/**
 * The global application logger instance.
 * @type {winston.Logger}
 */
export const logger = createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'devwatch-api' },
  transports: [consoleTransport, combinedFileTransport, errorFileTransport],
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
});

// ── Morgan Stream ─────────────────────────────────────────────────────────────

/**
 * Adapter to pipe Morgan HTTP logs into Winston at the 'http' level.
 * @type {{ write: (message: string) => void }}
 */
export const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};
