/**
 * @fileoverview Monitoring routes — Phase 6 production implementation.
 *
 * All routes require a valid JWT access token via the `authenticate` middleware.
 * Project-level authorization (owner/admin/member) is enforced in the service layer.
 *
 * IMPORTANT: Route order matters here.
 * `/latest`, `/history`, and `/analytics` must be declared BEFORE `/:projectId`
 * to prevent Express matching 'latest', 'history', 'analytics' as a projectId param.
 *
 * Registered endpoints:
 *   POST  /api/v1/monitoring                         (authenticated — owner/admin)
 *   GET   /api/v1/monitoring/latest                  (authenticated — owner/member/admin)
 *   GET   /api/v1/monitoring/history                 (authenticated — owner/member/admin)
 *   GET   /api/v1/monitoring/analytics               (authenticated — owner/member/admin)
 *   GET   /api/v1/monitoring/projects/:projectId     (authenticated — owner/member/admin)
 */

import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import {
  createMonitoringSchema,
  monitoringQuerySchema,
  analyticsQuerySchema,
} from '../validators/monitoring.validator.js';

const router = Router();

// Singleton controller instance — all methods are bound in the constructor
const monitoringController = new MonitoringController();

// ── All monitoring routes require authentication ───────────────────────────────
router.use(authenticate);

// ── Collection Routes ─────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/monitoring
 * @desc    Record a new monitoring snapshot for a project
 * @access  Authenticated — project owner or admin only
 * @body    { projectId, cpuUsage?, memoryUsage?, diskUsage?, networkUsage?,
 *            responseTime?, availability?, errorRate?, collectedAt? }
 */
router.post('/', validate(createMonitoringSchema), catchAsync(monitoringController.recordSnapshot));

/**
 * @route   GET /api/v1/monitoring/latest
 * @desc    Get the latest monitoring snapshot for a project
 * @access  Authenticated — owner / member / admin
 * @query   projectId (required)
 */
router.get(
  '/latest',
  validate(monitoringQuerySchema, 'query'),
  catchAsync(monitoringController.getLatest)
);

/**
 * @route   GET /api/v1/monitoring/history
 * @desc    Get paginated monitoring history
 * @access  Authenticated — owner / member / admin
 * @query   projectId, startDate?, endDate?, page?, limit?, sortBy?, sortOrder?
 */
router.get(
  '/history',
  validate(monitoringQuerySchema, 'query'),
  catchAsync(monitoringController.getHistory)
);

/**
 * @route   GET /api/v1/monitoring/analytics
 * @desc    Get aggregated analytics for a project
 * @access  Authenticated — owner / member / admin
 * @query   projectId (required), startDate?, endDate?, granularity?
 */
router.get(
  '/analytics',
  validate(analyticsQuerySchema, 'query'),
  catchAsync(monitoringController.getAnalytics)
);

// ── Project-Scoped Metrics Route ──────────────────────────────────────────────

/**
 * @route   GET /api/v1/monitoring/projects/:projectId
 * @desc    Get latest snapshot + last-24h KPIs for a single project
 * @access  Authenticated — owner / member / admin
 */
router.get('/projects/:projectId', catchAsync(monitoringController.getProjectMetrics));

export default router;
