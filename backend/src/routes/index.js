/**
 * @fileoverview Master API router for version 1.
 *
 * Aggregates all feature route modules under the /api/v1 prefix.
 * This is the single file to update when adding new Phase 3+ modules.
 *
 * Current routes:
 *   /api/v1/health  → health.routes.js
 *   /api/v1/auth    → auth.routes.js
 *
 * Future routes (Phase 3+):
 *   /api/v1/monitoring
 *   /api/v1/alerts
 *   /api/v1/ai
 *   /api/v1/analytics
 *   /api/v1/kubernetes
 *   /api/v1/docker
 *   /api/v1/cicd
 *   /api/v1/notifications
 *   /api/v1/audit
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import { logger } from '../config/logger.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';

const router = Router();

// ── Route Mounting ────────────────────────────────────────────────────────────

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// ── Startup Route Logging ─────────────────────────────────────────────────────

/**
 * Logs every registered API route to the console at server startup.
 * Call once from server.js after the HTTP server begins listening.
 *
 * @param {string} [prefix='/api/v1'] - The versioned API prefix
 * @returns {void}
 */
export const logRegisteredRoutes = (prefix = `/${APP_CONSTANTS.API_VERSION}`) => {
  const apiPrefix = `/api${prefix}`;

  /** @type {Array<{ method: string; path: string; access: string }>} */
  const routes = [
    { method: 'GET   ', path: `${apiPrefix}/health`, access: 'public' },
    { method: 'GET   ', path: `${apiPrefix}/health/ping`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/register`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/login`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/refresh`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/forgot-password`, access: 'public' },
    { method: 'PATCH ', path: `${apiPrefix}/auth/reset-password`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/logout`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/auth/me`, access: 'protected' },
  ];

  logger.info('─────────────────────────────────────────────');
  logger.info('  Registered API Routes');
  logger.info('─────────────────────────────────────────────');

  for (const route of routes) {
    const accessLabel = route.access === 'protected' ? '🔒' : '🌐';
    logger.info(`  ${route.method}  ${route.path}  ${accessLabel}`);
  }

  logger.info('─────────────────────────────────────────────');
};

export default router;
