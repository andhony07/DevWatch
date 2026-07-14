/**
 * @fileoverview MonitoringRepository — data-access layer for Monitoring documents.
 *
 * Extends BaseRepository with time-series–oriented query methods:
 *   - Latest snapshot retrieval
 *   - Time-range queries
 *   - Aggregated metric averages
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

  // ── Aggregations ──────────────────────────────────────────────────────────────

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

  /**
   * Deletes all monitoring records for a project older than the given date.
   * Used by data-retention cleanup jobs.
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
}
