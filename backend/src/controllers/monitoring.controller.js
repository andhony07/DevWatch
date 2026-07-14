/**
 * @fileoverview MonitoringController — thin HTTP adapter for MonitoringService — Phase 6.
 *
 * Responsibilities:
 *   - Extract validated data from req.body / req.params / req.query
 *   - Build DTOs and delegate to MonitoringService
 *   - Return standardized ApiResponse envelopes
 *   - Never contain business logic
 *
 * All methods are wrapped with catchAsync by the router.
 * req.user is populated by the `authenticate` middleware.
 */

import { MonitoringService } from '../services/monitoring.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  CreateMonitoringDTO,
  MonitoringQueryDTO,
  AnalyticsQueryDTO,
} from '../dto/monitoring/monitoring.dto.js';
import { MESSAGES } from '../constants/messages.js';

export class MonitoringController {
  /**
   * @param {MonitoringService} [monitoringService] - Optional injection for testing
   */
  constructor(monitoringService = new MonitoringService()) {
    this.monitoringService = monitoringService;

    // Bind all methods so they survive router destructuring
    this.recordSnapshot = this.recordSnapshot.bind(this);
    this.getLatest = this.getLatest.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getProjectMetrics = this.getProjectMetrics.bind(this);
    this.getAnalytics = this.getAnalytics.bind(this);
  }

  // ── POST /monitoring ──────────────────────────────────────────────────────────

  /**
   * Records a new metric snapshot for a project.
   * The requesting user must be the project owner or an admin.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async recordSnapshot(req, res) {
    const dto = CreateMonitoringDTO.fromRequest(req.body);
    const { snapshot } = await this.monitoringService.recordSnapshot(
      dto,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.created(res, MESSAGES.MONITORING.SNAPSHOT_CREATED, { snapshot });
  }

  // ── GET /monitoring/latest ────────────────────────────────────────────────────

  /**
   * Returns the most recent monitoring snapshot for a project.
   * Requires ?projectId query parameter.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getLatest(req, res) {
    const { projectId } = req.query;

    if (!projectId) {
      // The validator should catch this, but we guard defensively
      return ApiResponse.ok(res, MESSAGES.MONITORING.LATEST_FETCHED, { snapshot: null });
    }

    const { snapshot } = await this.monitoringService.getLatestMetrics(
      projectId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.MONITORING.LATEST_FETCHED, { snapshot });
  }

  // ── GET /monitoring/history ───────────────────────────────────────────────────

  /**
   * Returns a paginated monitoring history.
   * Supports ?projectId, ?startDate, ?endDate, ?page, ?limit, ?sortBy, ?sortOrder.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getHistory(req, res) {
    const queryDto = MonitoringQueryDTO.fromRequest(req.query);
    const { snapshots, pagination } = await this.monitoringService.getHistory(
      queryDto,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.MONITORING.HISTORY_FETCHED, { snapshots }, pagination);
  }

  // ── GET /monitoring/projects/:projectId ───────────────────────────────────────

  /**
   * Returns the latest snapshot + last-24h KPIs for a single project.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getProjectMetrics(req, res) {
    const { projectId } = req.params;
    const data = await this.monitoringService.getProjectMetrics(
      projectId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.MONITORING.PROJECT_METRICS_FETCHED, data);
  }

  // ── GET /monitoring/analytics ─────────────────────────────────────────────────

  /**
   * Returns full aggregated analytics for a project.
   * Requires ?projectId; supports ?startDate, ?endDate, ?granularity.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getAnalytics(req, res) {
    const analyticsDto = AnalyticsQueryDTO.fromRequest(req.query);
    const { analytics } = await this.monitoringService.getAnalytics(
      analyticsDto,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.MONITORING.ANALYTICS_FETCHED, { analytics });
  }
}
