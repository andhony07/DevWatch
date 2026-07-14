/**
 * @fileoverview Monitoring DTOs (Data Transfer Objects) — Phase 6.
 *
 * All DTOs are immutable value objects with static `fromRequest()` factories
 * and serialization helpers. They carry data between the HTTP layer and the
 * service layer without any business logic.
 *
 * DTOs defined here:
 *   CreateMonitoringDTO    — POST /monitoring body
 *   MonitoringQueryDTO     — GET /monitoring/history & /latest query params
 *   AnalyticsQueryDTO      — GET /monitoring/analytics query params
 *   MonitoringResponseDTO  — serializes a Mongoose Monitoring document
 *   AnalyticsResponseDTO   — serializes aggregation pipeline results
 */

import { APP_CONSTANTS } from '../../constants/appConstants.js';

const { PAGINATION } = APP_CONSTANTS;

// ── CreateMonitoringDTO ───────────────────────────────────────────────────────

/**
 * @class CreateMonitoringDTO
 * Carries metric snapshot data from the HTTP layer into the service.
 */
export class CreateMonitoringDTO {
  /**
   * @param {object} params
   * @param {string}  params.projectId      - Target project ObjectId (required)
   * @param {number}  [params.cpuUsage]     - 0–100
   * @param {number}  [params.memoryUsage]  - 0–100
   * @param {number}  [params.diskUsage]    - 0–100
   * @param {object}  [params.networkUsage] - { inbound, outbound } in bytes/s
   * @param {number}  [params.responseTime] - ms
   * @param {number}  [params.availability] - 0–100
   * @param {number}  [params.errorRate]    - 0–100
   * @param {string}  [params.collectedAt]  - ISO timestamp (defaults to now)
   */
  constructor({
    projectId,
    cpuUsage,
    memoryUsage,
    diskUsage,
    networkUsage,
    responseTime,
    availability,
    errorRate,
    collectedAt,
  }) {
    this.projectId = projectId?.trim();
    this.cpuUsage = cpuUsage ?? null;
    this.memoryUsage = memoryUsage ?? null;
    this.diskUsage = diskUsage ?? null;
    this.networkUsage = networkUsage
      ? {
          inbound: networkUsage.inbound ?? null,
          outbound: networkUsage.outbound ?? null,
        }
      : null;
    this.responseTime = responseTime ?? null;
    this.availability = availability ?? null;
    this.errorRate = errorRate ?? null;
    this.collectedAt = collectedAt ? new Date(collectedAt) : new Date();
  }

  /**
   * @param {object} body - req.body
   * @returns {CreateMonitoringDTO}
   */
  static fromRequest(body) {
    return new CreateMonitoringDTO(body);
  }

  /**
   * Returns the plain object ready to be persisted to MongoDB.
   * Maps `projectId` → `project` to match the Monitoring schema.
   *
   * @returns {object}
   */
  toDocument() {
    const doc = {
      project: this.projectId,
      collectedAt: this.collectedAt,
    };

    if (this.cpuUsage !== null) {
      doc.cpuUsage = this.cpuUsage;
    }
    if (this.memoryUsage !== null) {
      doc.memoryUsage = this.memoryUsage;
    }
    if (this.diskUsage !== null) {
      doc.diskUsage = this.diskUsage;
    }
    if (this.networkUsage !== null) {
      doc.networkUsage = this.networkUsage;
    }
    if (this.responseTime !== null) {
      doc.responseTime = this.responseTime;
    }
    if (this.availability !== null) {
      doc.availability = this.availability;
    }
    if (this.errorRate !== null) {
      doc.errorRate = this.errorRate;
    }

    return doc;
  }
}

// ── MonitoringQueryDTO ────────────────────────────────────────────────────────

/**
 * @class MonitoringQueryDTO
 * Carries pagination, sorting, date-range, and project filter options from
 * query parameters for list/history endpoints.
 */
export class MonitoringQueryDTO {
  /**
   * @param {object} params
   * @param {string}       [params.projectId]
   * @param {number|string}[params.page]
   * @param {number|string}[params.limit]
   * @param {string}       [params.sortBy]
   * @param {string}       [params.sortOrder]
   * @param {string}       [params.startDate]
   * @param {string}       [params.endDate]
   */
  constructor({ projectId, page, limit, sortBy, sortOrder, startDate, endDate } = {}) {
    this.projectId = projectId ?? null;
    this.page = Math.max(1, parseInt(page, 10) || PAGINATION.DEFAULT_PAGE);
    this.limit = Math.min(
      Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT),
      PAGINATION.MAX_LIMIT
    );

    const VALID_SORT_BY = ['timestamp', 'cpuUsage', 'memoryUsage', 'responseTime', 'collectedAt'];
    this.sortBy = VALID_SORT_BY.includes(sortBy)
      ? sortBy === 'timestamp'
        ? 'collectedAt'
        : sortBy
      : 'collectedAt';
    this.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    this.startDate = startDate ? new Date(startDate) : null;
    this.endDate = endDate ? new Date(endDate) : null;
  }

  /**
   * @param {object} query - req.query
   * @returns {MonitoringQueryDTO}
   */
  static fromRequest(query) {
    return new MonitoringQueryDTO(query);
  }

  /**
   * Returns the Mongoose sort string (e.g. '-collectedAt').
   *
   * @returns {string}
   */
  get sortString() {
    return `${this.sortOrder === 'desc' ? '-' : ''}${this.sortBy}`;
  }
}

// ── AnalyticsQueryDTO ─────────────────────────────────────────────────────────

/**
 * @class AnalyticsQueryDTO
 * Carries analytics query options from query parameters.
 */
export class AnalyticsQueryDTO {
  /**
   * @param {object} params
   * @param {string} params.projectId    - Required
   * @param {string} [params.startDate]
   * @param {string} [params.endDate]
   * @param {string} [params.granularity] - 'hour' | 'day' (default: 'hour')
   */
  constructor({ projectId, startDate, endDate, granularity } = {}) {
    this.projectId = projectId ?? null;
    this.startDate = startDate ? new Date(startDate) : null;
    this.endDate = endDate ? new Date(endDate) : null;
    this.granularity = ['hour', 'day'].includes(granularity) ? granularity : 'hour';
  }

  /**
   * @param {object} query - req.query
   * @returns {AnalyticsQueryDTO}
   */
  static fromRequest(query) {
    return new AnalyticsQueryDTO(query);
  }
}

// ── MonitoringResponseDTO ─────────────────────────────────────────────────────

/**
 * @class MonitoringResponseDTO
 * Serializes a Mongoose Monitoring document into a clean, stable API response.
 */
export class MonitoringResponseDTO {
  /**
   * @param {import('mongoose').Document} doc
   */
  constructor(doc) {
    const plain = doc.toJSON ? doc.toJSON() : doc;

    this.id = plain.id ?? plain._id;
    this.project = plain.project;
    this.cpuUsage = plain.cpuUsage;
    this.memoryUsage = plain.memoryUsage;
    this.diskUsage = plain.diskUsage;
    this.networkUsage = plain.networkUsage ?? null;
    this.responseTime = plain.responseTime;
    this.availability = plain.availability;
    this.errorRate = plain.errorRate;
    this.collectedAt = plain.collectedAt;
    this.healthStatus = plain.healthStatus ?? null;
  }

  /**
   * @param {import('mongoose').Document} doc
   * @returns {MonitoringResponseDTO}
   */
  static fromDocument(doc) {
    return new MonitoringResponseDTO(doc);
  }

  /**
   * @param {import('mongoose').Document[]} docs
   * @returns {MonitoringResponseDTO[]}
   */
  static fromDocuments(docs) {
    return docs.map((doc) => new MonitoringResponseDTO(doc));
  }
}

// ── AnalyticsResponseDTO ──────────────────────────────────────────────────────

/**
 * @class AnalyticsResponseDTO
 * Serializes aggregated analytics data (from aggregation pipelines + pure computations)
 * into a clean, consistent API response shape.
 */
export class AnalyticsResponseDTO {
  /**
   * @param {object} params
   * @param {string}   params.projectId
   * @param {object}   [params.dateRange]    - { startDate, endDate }
   * @param {string}   [params.granularity]
   * @param {object}   [params.averages]     - avgCpu, avgMemory, avgDisk, avgResponseTime, avgAvailability, avgErrorRate
   * @param {object}   [params.peaks]        - peakCpu, peakMemory, peakResponseTime
   * @param {object}   [params.percentiles]  - p50ResponseTime, p95ResponseTime, p99ResponseTime
   * @param {object}   [params.uptime]       - uptimePercentage, downtimePercentage
   * @param {object}   [params.errorTrend]   - trend, delta, direction
   * @param {number}   [params.healthScore]  - 0–100
   * @param {number}   [params.sampleCount]
   * @param {object[]} [params.timeSeries]   - Aggregated time-series buckets
   */
  constructor({
    projectId,
    dateRange = null,
    granularity = 'hour',
    averages = null,
    peaks = null,
    percentiles = null,
    uptime = null,
    errorTrend = null,
    healthScore = null,
    sampleCount = 0,
    timeSeries = [],
  }) {
    this.projectId = projectId;
    this.dateRange = dateRange;
    this.granularity = granularity;
    this.averages = averages;
    this.peaks = peaks;
    this.percentiles = percentiles;
    this.uptime = uptime;
    this.errorTrend = errorTrend;
    this.healthScore = healthScore;
    this.sampleCount = sampleCount;
    this.timeSeries = timeSeries;
  }

  /**
   * @param {object} data
   * @returns {AnalyticsResponseDTO}
   */
  static fromData(data) {
    return new AnalyticsResponseDTO(data);
  }
}
