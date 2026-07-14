/**
 * @fileoverview MonitoringRepository — data-access layer for Monitoring documents.
 *
 * Extends BaseRepository with time-series–oriented query methods:
 *   - Latest snapshot retrieval
 *   - Time-range queries with pagination
 *   - Aggregated metric averages (existing)
 *   - Extended aggregation pipelines (Phase 6):
 *       aggregateByPeriod()  — hourly / daily bucketing
 *       calculateKPIs()      — peak values, median, uptime
 *       findLatestForProjects() — multi-project dashboard
 *       createSnapshot()     — semantic alias for create()
 *       findHistory()        — paginated time-range with filter
 *       globalCleanup()      — cross-project retention cleanup
 */

import mongoose from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { Monitoring } from '../models/index.js';

export class MonitoringRepository extends BaseRepository {
  constructor() {
    super(Monitoring);
  }

  // ── Time-Series Queries ───────────────────────────────────────────────────────

  /**
   * Returns paginated monitoring records for a project, newest first.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {object} [options] - Pagination options
   * @returns {Promise<object>} Paginated result
   */
  findByProject(projectId, options = {}) {
    return this.paginate({ project: projectId }, { sort: '-collectedAt', ...options });
  }

  /**
   * Returns the single most recent monitoring record for a project.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findLatestByProject(projectId) {
    return this.findOne({ project: projectId }, { sort: '-collectedAt' });
  }

  /**
   * Returns all monitoring records collected within the specified time range.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {Date} from - Range start (inclusive)
   * @param {Date} to   - Range end (inclusive)
   * @returns {Promise<import('mongoose').Document[]>}
   */
  findInTimeRange(projectId, from, to) {
    return this.findMany(
      { project: projectId, collectedAt: { $gte: from, $lte: to } },
      { sort: 'collectedAt' }
    );
  }

  // ── Phase 6: Semantic Alias ───────────────────────────────────────────────────

  /**
   * Semantic alias for `create()` — persists a new metric snapshot.
   *
   * @param {object} data - Monitoring document payload (from CreateMonitoringDTO.toDocument())
   * @returns {Promise<import('mongoose').Document>}
   */
  createSnapshot(data) {
    return this.create(data);
  }

  // ── Phase 6: Paginated History ────────────────────────────────────────────────

  /**
   * Returns a paginated history of monitoring records with optional date-range filtering.
   *
   * @param {object} filter
   * @param {string|mongoose.Types.ObjectId} [filter.project] - Project ObjectId
   * @param {Date}   [filter.startDate]
   * @param {Date}   [filter.endDate]
   * @param {object} [options] - Pagination / sort options
   * @returns {Promise<object>} Paginated result
   */
  findHistory({ project, startDate, endDate } = {}, options = {}) {
    const mongoFilter = {};

    if (project) {
      mongoFilter.project = project;
    }

    if (startDate || endDate) {
      mongoFilter.collectedAt = {};
      if (startDate) {
        mongoFilter.collectedAt.$gte = startDate;
      }
      if (endDate) {
        mongoFilter.collectedAt.$lte = endDate;
      }
    }

    return this.paginate(mongoFilter, { sort: '-collectedAt', ...options });
  }

  // ── Phase 6: Multi-Project Latest ────────────────────────────────────────────

  /**
   * Returns the latest monitoring snapshot for each of the provided project IDs.
   * Uses aggregation to efficiently get the most recent record per project.
   *
   * @param {Array<string|mongoose.Types.ObjectId>} projectIds
   * @returns {Promise<object[]>} Array of { project, latest } objects
   */
  findLatestForProjects(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const objectIds = projectIds.map((id) =>
      id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
    );

    return this.model.aggregate([
      { $match: { project: { $in: objectIds } } },
      { $sort: { project: 1, collectedAt: -1 } },
      {
        $group: {
          _id: '$project',
          latestDoc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$latestDoc' },
      },
      {
        $addFields: {
          id: '$_id',
        },
      },
    ]);
  }

  // ── Phase 6: Time-Series Aggregation ─────────────────────────────────────────

  /**
   * Aggregates monitoring records into hourly or daily time-series buckets.
   * Returns avg/min/max for each metric per bucket.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {Date}   [from]
   * @param {Date}   [to]
   * @param {'hour'|'day'} [granularity='hour']
   * @returns {Promise<object[]>}
   */
  aggregateByPeriod(projectId, from, to, granularity = 'hour') {
    const match = { project: new mongoose.Types.ObjectId(projectId) };

    if (from || to) {
      match.collectedAt = {};
      if (from) {
        match.collectedAt.$gte = from;
      }
      if (to) {
        match.collectedAt.$lte = to;
      }
    }

    // Build the date truncation expression based on granularity
    const truncateDate =
      granularity === 'day'
        ? {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$collectedAt',
              timezone: 'UTC',
            },
          }
        : {
            $dateToString: {
              format: '%Y-%m-%dT%H:00:00.000Z',
              date: '$collectedAt',
              timezone: 'UTC',
            },
          };

    return this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: truncateDate,
          avgCpu: { $avg: '$cpuUsage' },
          maxCpu: { $max: '$cpuUsage' },
          avgMemory: { $avg: '$memoryUsage' },
          maxMemory: { $max: '$memoryUsage' },
          avgDisk: { $avg: '$diskUsage' },
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          avgAvailability: { $avg: '$availability' },
          avgErrorRate: { $avg: '$errorRate' },
          sampleCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          avgCpu: { $round: ['$avgCpu', 2] },
          maxCpu: { $round: ['$maxCpu', 2] },
          avgMemory: { $round: ['$avgMemory', 2] },
          maxMemory: { $round: ['$maxMemory', 2] },
          avgDisk: { $round: ['$avgDisk', 2] },
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          minResponseTime: { $round: ['$minResponseTime', 2] },
          maxResponseTime: { $round: ['$maxResponseTime', 2] },
          avgAvailability: { $round: ['$avgAvailability', 4] },
          avgErrorRate: { $round: ['$avgErrorRate', 4] },
          sampleCount: 1,
        },
      },
    ]);
  }

  // ── Phase 6: KPI Calculation ──────────────────────────────────────────────────

  /**
   * Calculates comprehensive KPIs for a project over a given time range.
   * Returns peak values, medians, and availability/error stats.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {Date} [from]
   * @param {Date} [to]
   * @returns {Promise<object|null>}
   */
  async calculateKPIs(projectId, from, to) {
    const match = { project: new mongoose.Types.ObjectId(projectId) };

    if (from || to) {
      match.collectedAt = {};
      if (from) {
        match.collectedAt.$gte = from;
      }
      if (to) {
        match.collectedAt.$lte = to;
      }
    }

    const [result] = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgCpu: { $avg: '$cpuUsage' },
          peakCpu: { $max: '$cpuUsage' },
          avgMemory: { $avg: '$memoryUsage' },
          peakMemory: { $max: '$memoryUsage' },
          avgDisk: { $avg: '$diskUsage' },
          avgNetworkInbound: { $avg: '$networkUsage.inbound' },
          avgNetworkOutbound: { $avg: '$networkUsage.outbound' },
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' },
          avgAvailability: { $avg: '$availability' },
          avgErrorRate: { $avg: '$errorRate' },
          sampleCount: { $sum: 1 },
          // Collect arrays for median/percentile computation in memory
          responseTimes: {
            $push: {
              $cond: [{ $ne: ['$responseTime', null] }, '$responseTime', '$$REMOVE'],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          avgCpu: { $round: ['$avgCpu', 2] },
          peakCpu: { $round: ['$peakCpu', 2] },
          avgMemory: { $round: ['$avgMemory', 2] },
          peakMemory: { $round: ['$peakMemory', 2] },
          avgDisk: { $round: ['$avgDisk', 2] },
          avgNetworkInbound: { $round: ['$avgNetworkInbound', 2] },
          avgNetworkOutbound: { $round: ['$avgNetworkOutbound', 2] },
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
          minResponseTime: { $round: ['$minResponseTime', 2] },
          maxResponseTime: { $round: ['$maxResponseTime', 2] },
          avgAvailability: { $round: ['$avgAvailability', 4] },
          avgErrorRate: { $round: ['$avgErrorRate', 4] },
          sampleCount: 1,
          responseTimes: 1,
        },
      },
    ]);

    return result ?? null;
  }

  // ── Existing: Average Metrics ─────────────────────────────────────────────────

  /**
   * Calculates average metric values for a project over a given time range.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {Date} [from] - Optional range start
   * @param {Date} [to]   - Optional range end
   * @returns {Promise<{
   *   avgCpu: number|null,
   *   avgMemory: number|null,
   *   avgDisk: number|null,
   *   avgResponseTime: number|null,
   *   avgAvailability: number|null,
   *   avgErrorRate: number|null,
   *   sampleCount: number
   * }|null>}
   */
  async getAverageMetrics(projectId, from, to) {
    const match = { project: new mongoose.Types.ObjectId(projectId) };
    if (from || to) {
      match.collectedAt = {};
      if (from) {
        match.collectedAt.$gte = from;
      }
      if (to) {
        match.collectedAt.$lte = to;
      }
    }

    const [result] = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgCpu: { $avg: '$cpuUsage' },
          avgMemory: { $avg: '$memoryUsage' },
          avgDisk: { $avg: '$diskUsage' },
          avgResponseTime: { $avg: '$responseTime' },
          avgAvailability: { $avg: '$availability' },
          avgErrorRate: { $avg: '$errorRate' },
          sampleCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return result ?? null;
  }

  // ── Existing: Data Retention ──────────────────────────────────────────────────

  /**
   * Deletes all monitoring records for a project older than the given date.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {Date} olderThan
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteOlderThan(projectId, olderThan) {
    const result = await this.model.deleteMany({
      project: projectId,
      collectedAt: { $lt: olderThan },
    });
    return result.deletedCount;
  }

  // ── Phase 6: Global Cleanup ───────────────────────────────────────────────────

  /**
   * Deletes ALL monitoring records (across all projects) older than `olderThan`.
   * Used by the scheduled data-retention cleanup job.
   *
   * @param {Date} olderThan
   * @returns {Promise<number>} Number of deleted records
   */
  async globalCleanup(olderThan) {
    const result = await this.model.deleteMany({
      collectedAt: { $lt: olderThan },
    });
    return result.deletedCount;
  }
}
