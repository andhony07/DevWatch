/**
 * @fileoverview Master API router for version 1.
 *
 * Aggregates all feature route modules under the /api/v1 prefix.
 * This is the single file to update when adding new Phase modules.
 *
 * Current routes:
 *   /api/v1/health       → health.routes.js
 *   /api/v1/auth         → auth.routes.js
 *   /api/v1/projects     → project.routes.js
 *   /api/v1/monitoring   → monitoring.routes.js  ← Phase 6
 *
 * Future routes (Phase 7+):
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
import projectRoutes from './project.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import { logger } from '../config/logger.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';

const { API_VERSION } = APP_CONSTANTS;

const router = Router();

// ── Route Mounting ────────────────────────────────────────────────────────────

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/monitoring', monitoringRoutes);

// ── Startup Route Logging ─────────────────────────────────────────────────────

/**
 * Logs every registered API route to the console at server startup.
 *
 * @param {string} [prefix='/v1']
 * @returns {void}
 */
export const logRegisteredRoutes = (prefix = `/${API_VERSION}`) => {
  const apiPrefix = `/api${prefix}`;

  /** @type {Array<{ method: string; path: string; access: string }>} */
  const routes = [
    // ── Health ────────────────────────────────────────────────
    { method: 'GET   ', path: `${apiPrefix}/health`, access: 'public' },
    { method: 'GET   ', path: `${apiPrefix}/health/ping`, access: 'public' },

    // ── Auth ──────────────────────────────────────────────────
    { method: 'POST  ', path: `${apiPrefix}/auth/register`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/login`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/refresh`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/forgot-password`, access: 'public' },
    { method: 'PATCH ', path: `${apiPrefix}/auth/reset-password`, access: 'public' },
    { method: 'POST  ', path: `${apiPrefix}/auth/logout`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/auth/me`, access: 'protected' },

    // ── Projects ──────────────────────────────────────────────
    { method: 'POST  ', path: `${apiPrefix}/projects`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/projects`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/projects/:projectId`, access: 'protected' },
    { method: 'PATCH ', path: `${apiPrefix}/projects/:projectId`, access: 'protected' },
    { method: 'DELETE', path: `${apiPrefix}/projects/:projectId`, access: 'protected' },
    { method: 'PATCH ', path: `${apiPrefix}/projects/:projectId/restore`, access: 'protected' },
    { method: 'POST  ', path: `${apiPrefix}/projects/:projectId/members`, access: 'protected' },
    {
      method: 'DELETE',
      path: `${apiPrefix}/projects/:projectId/members/:userId`,
      access: 'protected',
    },

    // ── Monitoring (Phase 6) ──────────────────────────────────
    { method: 'POST  ', path: `${apiPrefix}/monitoring`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/monitoring/latest`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/monitoring/history`, access: 'protected' },
    { method: 'GET   ', path: `${apiPrefix}/monitoring/analytics`, access: 'protected' },
    {
      method: 'GET   ',
      path: `${apiPrefix}/monitoring/projects/:projectId`,
      access: 'protected',
    },
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
