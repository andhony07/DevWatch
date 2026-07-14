/**
 * @fileoverview Health check route handlers.
 *
 * Endpoints:
 *   GET /api/v1/health       — Full health report (status, uptime, db, environment)
 *   GET /api/v1/health/ping  — Minimal liveness probe (returns 200 immediately)
 */

import { Router } from 'express';
import { getDatabaseStatus } from '../database/mongo.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { formatUptime } from '../utils/helpers.js';

const router = Router();

// ── GET /api/v1/health ────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/health
 * @desc    Full system health check
 * @access  Public
 */
router.get('/', (_req, res) => {
  const mongoStatus = getDatabaseStatus();
  const isHealthy = mongoStatus === 'connected';
  const uptimeSeconds = process.uptime();

  const data = {
    status: isHealthy ? 'healthy' : 'degraded',
    uptime: Math.floor(uptimeSeconds),
    uptimeHuman: formatUptime(uptimeSeconds),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: APP_CONSTANTS.APP_VERSION,
    mongoStatus,
  };

  return ApiResponse.ok(res, isHealthy ? MESSAGES.HEALTH.OK : MESSAGES.HEALTH.DEGRADED, data);
});

// ── GET /api/v1/health/ping ───────────────────────────────────────────────────

/**
 * @route   GET /api/v1/health/ping
 * @desc    Minimal liveness probe for load balancers and Kubernetes readiness checks
 * @access  Public
 */
router.get('/ping', (_req, res) => {
  res.status(200).json({
    pong: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
