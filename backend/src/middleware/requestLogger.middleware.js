/**
 * @fileoverview Per-request logging middleware.
 *
 * Responsibilities:
 *   - Attaches a unique Request ID to every incoming request (from header or generated)
 *   - Sets X-Request-ID response header so clients can correlate requests
 *   - Logs request arrival with method, URL, IP, and User-Agent
 *   - Logs response completion with status code and response time
 *   - Exposes req.id for use in error handlers and downstream logging
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import { isProduction } from '../utils/helpers.js';

/**
 * Request logger middleware.
 * Attaches `req.id` and the `X-Request-ID` header, then logs request/response lifecycle.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
export const requestLogger = (req, res, next) => {
  // Honor incoming request ID from reverse proxy / client, or generate a new one
  const requestId =
    typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : uuidv4();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startAt = process.hrtime.bigint();

  // ── Request Log ──────────────────────────────────────────────────────────
  /** @type {object} */
  const requestLog = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  // Include request body in development (excluding auth routes for security)
  if (!isProduction() && req.body && Object.keys(req.body).length > 0) {
    const isAuthRoute = req.originalUrl.includes('/auth/');
    if (!isAuthRoute) {
      requestLog.body = req.body;
    }
  }

  logger.http(`→ ${req.method} ${req.originalUrl}`, requestLog);

  // ── Response Log ─────────────────────────────────────────────────────────
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startAt;
    const durationMs = Number(durationNs / 1_000_000n);

    /** @type {object} */
    const responseLog = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };

    const summary = `← ${req.method} ${req.originalUrl} ${res.statusCode} [${durationMs}ms]`;

    if (res.statusCode >= 500) {
      logger.error(summary, responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn(summary, responseLog);
    } else {
      logger.http(summary, responseLog);
    }
  });

  next();
};
