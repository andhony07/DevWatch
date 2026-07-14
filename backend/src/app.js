/**
 * @fileoverview Express application factory.
 *
 * Wires all middleware, security layers, parsers, rate limiting, and routes
 * into a single Express application instance. Does NOT start listening —
 * that responsibility belongs to server.js.
 *
 * Middleware order (intentional — do not reorder):
 *   1. Helmet          — security headers
 *   2. Compression     — gzip response compression
 *   3. CORS            — cross-origin resource sharing
 *   4. Morgan          — HTTP access logging (piped to Winston)
 *   5. JSON parser     — req.body for application/json
 *   6. URL-encoded     — req.body for form submissions
 *   7. Cookie parser   — req.cookies / req.signedCookies
 *   8. Rate limiter    — applied to /api/* only
 *   9. Request logger  — per-request UUID and lifecycle logging
 *  10. Routes          — /api/v1 feature routes
 *  11. 404 handler     — catch-all for unmatched routes
 *  12. Error handler   — global error normalizer and responder
 */

import 'express-async-errors';

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config/env.js';
import { morganStream } from './config/logger.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { APP_CONSTANTS } from './constants/appConstants.js';
import { MESSAGES } from './constants/messages.js';
import apiRouter from './routes/index.js';

const { RATE_LIMIT } = APP_CONSTANTS;

/** @type {express.Application} */
const app = express();

// ── 1. Security Headers ───────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: config.isProduction,
  })
);

// ── 2. Compression ────────────────────────────────────────────────────────────
app.use(compression());

// ── 3. CORS ───────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

// ── 4. HTTP Access Logging ────────────────────────────────────────────────────
app.use(
  morgan(config.isDevelopment ? 'dev' : 'combined', {
    stream: morganStream,
    skip: (_req, _res) => config.isTest,
  })
);

// ── 5. JSON Body Parser ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ── 6. URL-Encoded Body Parser ────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── 7. Cookie Parser ──────────────────────────────────────────────────────────
app.use(cookieParser(config.jwt.secret));

// ── 8. Rate Limiter (API-scoped) ──────────────────────────────────────────────
const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: RATE_LIMIT.SKIP_SUCCESSFUL_REQUESTS,
  skip: () => config.isTest,
  message: {
    success: false,
    statusCode: 429,
    message: MESSAGES.TOO_MANY_REQUESTS,
    timestamp: new Date().toISOString(),
  },
});

app.use('/api', apiRateLimiter);

// ── 9. Per-Request Logger ─────────────────────────────────────────────────────
app.use(requestLogger);

// ── 10. Feature Routes ────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// ── 11. 404 Not Found ─────────────────────────────────────────────────────────
app.use(notFoundMiddleware);

// ── 12. Global Error Handler ──────────────────────────────────────────────────
app.use(errorMiddleware);

export { app };
