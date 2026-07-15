/**
 * @fileoverview MonitoringService — monitoring engine business logic — Phase 6.
 *
 * Orchestrates all monitoring operations by coordinating:
 *   - MonitoringRepository  (data access)
 *   - ProjectRepository     (project existence / access checks)
 *   - monitoring.analytics  (pure KPI enrichment)
 *
 * This service contains NO HTTP concerns (no req/res/next).
 * All errors are thrown as ApiError instances for the error middleware.
 *
 * RBAC rules (enforced here, not in middleware):
 *   admin      → full access to all projects
 *   operator   → snapshot write if owner; read if owner or member
 *   viewer     → read-only if owner or member
 *
 * Methods:
 *   recordSnapshot(dto, userId, userRole)
 *   getLatestMetrics(projectId, userId, userRole)
 *   getHistory(queryDto, userId, userRole)
 *   getProjectMetrics(projectId, userId, userRole)
 *   getAnalytics(analyticsDto, userId, userRole)
 *   runRetentionCleanup(daysToRetain)
 */

import { MonitoringRepository } from '../repositories/MonitoringRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { MonitoringResponseDTO, AnalyticsResponseDTO } from '../dto/monitoring/monitoring.dto.js';
import { realtimeMonitoringService } from '../sockets/services/RealtimeMonitoringService.js';
import { enrichKPIs } from '../utils/monitoring.analytics.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { logger } from '../config/logger.js';

const { ROLES } = APP_CONSTANTS;

export class MonitoringService {
  /**
   * @param {MonitoringRepository} [monitoringRepository]
   * @param {ProjectRepository}    [projectRepository]
   */
  constructor(
    monitoringRepository = new MonitoringRepository(),
    projectRepository = new ProjectRepository()
  ) {
    this.monitoringRepo = monitoringRepository;
    this.projectRepo = projectRepository;
  }

  // ── RBAC Helpers ─────────────────────────────────────────────────────────────

  /**
   * Fetches a project and verifies it exists.
   * Returns the project document.
   *
   * @param {string} projectId
   * @returns {Promise<import('mongoose').Document>}
   */
  async _requireProject(projectId) {
    const project = await this.projectRepo.findWithTeam(projectId);
    if (!project) {
      throw ApiError.notFound(MESSAGES.MONITORING.PROJECT_NOT_FOUND);
    }
    return project;
  }

  /**
   * Returns true if the user is the project's owner.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @returns {boolean}
   */
  _isOwner(project, userId) {
    const ownerId = project.owner?._id ?? project.owner;
    return String(ownerId) === String(userId);
  }

  /**
   * Returns true if the user is a team member.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @returns {boolean}
   */
  _isMember(project, userId) {
    return (
      project.teamMembers?.some((m) => {
        const memberId = m?._id ?? m;
        return String(memberId) === String(userId);
      }) ?? false
    );
  }

  /**
   * Asserts the user can READ monitoring data for the project.
   * Admins see all; others must be owner or member.
   */
  _assertCanRead(project, userId, userRole) {
    if (userRole === ROLES.ADMIN) {
      return;
    }
    if (!this._isOwner(project, userId) && !this._isMember(project, userId)) {
      throw ApiError.forbidden(MESSAGES.MONITORING.FORBIDDEN_READ);
    }
  }

  /**
   * Asserts the user can WRITE (record snapshots) for the project.
   * Only admins and project owners may ingest metrics.
   */
  _assertCanWrite(project, userId, userRole) {
    if (userRole === ROLES.ADMIN) {
      return;
    }
    if (!this._isOwner(project, userId)) {
      throw ApiError.forbidden(MESSAGES.MONITORING.FORBIDDEN_WRITE);
    }
  }

  // ── Record Snapshot ───────────────────────────────────────────────────────────

  /**
   * Records a new monitoring snapshot for a project.
   * Validates project existence and write access before persisting.
   *
   * @param {import('../dto/monitoring/monitoring.dto.js').CreateMonitoringDTO} dto
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ snapshot: object }>}
   */
  async recordSnapshot(dto, userId, userRole) {
    const project = await this._requireProject(dto.projectId);
    this._assertCanWrite(project, userId, userRole);

    const snapshot = await this.monitoringRepo.createSnapshot(dto.toDocument());

    logger.info(
      `[MonitoringService] Snapshot recorded for project ${dto.projectId} by user ${userId}`
    );

    const snapshotDto = MonitoringResponseDTO.fromDocument(snapshot);

    // Broadcast the update via sockets (Phase 7)
    realtimeMonitoringService.broadcastMetricUpdate(dto.projectId, snapshotDto);

    return { snapshot: snapshotDto };
  }

  // ── Get Latest Metrics ────────────────────────────────────────────────────────

  /**
   * Returns the most recent monitoring snapshot for a project.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ snapshot: object|null }>}
   */
  async getLatestMetrics(projectId, userId, userRole) {
    const project = await this._requireProject(projectId);
    this._assertCanRead(project, userId, userRole);

    const snapshot = await this.monitoringRepo.findLatestByProject(projectId);

    return {
      snapshot: snapshot ? MonitoringResponseDTO.fromDocument(snapshot) : null,
    };
  }

  // ── Get History ───────────────────────────────────────────────────────────────

  /**
   * Returns a paginated history of monitoring records, optionally filtered by
   * date range. Access is scoped by RBAC.
   *
   * @param {import('../dto/monitoring/monitoring.dto.js').MonitoringQueryDTO} queryDto
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ snapshots: object[]; pagination: object }>}
   */
  async getHistory(queryDto, userId, userRole) {
    const { projectId, page, limit, sortString, startDate, endDate } = queryDto;

    // If projectId is supplied, verify access
    if (projectId) {
      const project = await this._requireProject(projectId);
      this._assertCanRead(project, userId, userRole);
    } else if (userRole !== ROLES.ADMIN) {
      // Non-admins must specify a projectId — they cannot list all history
      throw ApiError.badRequest('projectId is required to retrieve monitoring history.');
    }

    const result = await this.monitoringRepo.findHistory(
      {
        project: projectId ?? undefined,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      },
      { page, limit, sort: sortString }
    );

    return {
      snapshots: MonitoringResponseDTO.fromDocuments(result.data),
      pagination: result.pagination,
    };
  }

  // ── Get Project Metrics ───────────────────────────────────────────────────────

  /**
   * Returns a comprehensive metrics view for a single project:
   * the latest snapshot + average KPIs over the last 24 hours.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ latest: object|null; kpis: object|null; project: object }>}
   */
  async getProjectMetrics(projectId, userId, userRole) {
    const project = await this._requireProject(projectId);
    this._assertCanRead(project, userId, userRole);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [latest, rawKpis, recentSnaps] = await Promise.all([
      this.monitoringRepo.findLatestByProject(projectId),
      this.monitoringRepo.calculateKPIs(projectId, last24h, now),
      this.monitoringRepo.findInTimeRange(projectId, last24h, now),
    ]);

    const enriched = enrichKPIs(rawKpis, recentSnaps);

    return {
      latest: latest ? MonitoringResponseDTO.fromDocument(latest) : null,
      kpis: enriched,
      project: { id: project.id ?? project._id, name: project.name },
    };
  }

  // ── Get Analytics ─────────────────────────────────────────────────────────────

  /**
   * Returns full aggregated analytics for a project.
   * Supports configurable date range and hourly/daily granularity.
   *
   * @param {import('../dto/monitoring/monitoring.dto.js').AnalyticsQueryDTO} analyticsDto
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ analytics: object }>}
   */
  async getAnalytics(analyticsDto, userId, userRole) {
    const { projectId, startDate, endDate, granularity } = analyticsDto;

    const project = await this._requireProject(projectId);
    this._assertCanRead(project, userId, userRole);

    // Default date range: last 7 days if not specified
    const to = endDate ?? new Date();
    const from = startDate ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [rawKpis, timeSeries, recentSnaps] = await Promise.all([
      this.monitoringRepo.calculateKPIs(projectId, from, to),
      this.monitoringRepo.aggregateByPeriod(projectId, from, to, granularity),
      this.monitoringRepo.findInTimeRange(projectId, from, to),
    ]);

    if (!rawKpis || rawKpis.sampleCount === 0) {
      return {
        analytics: AnalyticsResponseDTO.fromData({
          projectId,
          dateRange: { startDate: from, endDate: to },
          granularity,
          sampleCount: 0,
          timeSeries: [],
        }),
      };
    }

    const enriched = enrichKPIs(rawKpis, recentSnaps);

    const analytics = AnalyticsResponseDTO.fromData({
      projectId,
      dateRange: { startDate: from, endDate: to },
      granularity,
      averages: enriched.averages,
      peaks: enriched.peaks,
      percentiles: enriched.percentiles,
      uptime: enriched.uptime,
      errorTrend: enriched.errorTrend,
      healthScore: enriched.healthScore,
      sampleCount: enriched.sampleCount,
      timeSeries,
    });

    logger.info(
      `[MonitoringService] Analytics computed for project ${projectId} — ${enriched.sampleCount} samples`
    );

    return { analytics };
  }

  // ── Retention Cleanup ─────────────────────────────────────────────────────────

  /**
   * Deletes all monitoring records older than `daysToRetain` days.
   * Called by the monitoring scheduler's CleanupJob.
   *
   * @param {number} [daysToRetain=90] - Records older than this are deleted
   * @returns {Promise<{ deleted: number; cutoffDate: Date }>}
   */
  async runRetentionCleanup(daysToRetain = 90) {
    const cutoffDate = new Date(Date.now() - daysToRetain * 24 * 60 * 60 * 1000);
    const deleted = await this.monitoringRepo.globalCleanup(cutoffDate);

    logger.info(
      `[MonitoringService] Retention cleanup: deleted ${deleted} records older than ${cutoffDate.toISOString()}`
    );

    return { deleted, cutoffDate };
  }
}
