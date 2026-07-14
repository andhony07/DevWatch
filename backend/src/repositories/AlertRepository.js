/**
 * @fileoverview AlertRepository — data-access layer for Alert documents.
 *
 * Extends BaseRepository with alert-specific query methods:
 *   - Open/resolved alert filtering per project
 *   - Severity-based queries
 *   - Alert lifecycle management (resolve, assign)
 *   - Summary statistics for dashboards
 */

import mongoose from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { Alert } from '../models/index.js';

export class AlertRepository extends BaseRepository {
  constructor() {
    super(Alert);
  }

  // ── Project-Scoped Queries ────────────────────────────────────────────────────

  /**
   * Returns paginated alerts for a project.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByProject(projectId, options = {}) {
    return this.paginate({ project: projectId }, { sort: '-triggeredAt', ...options });
  }

  /**
   * Returns only open or acknowledged alerts for a project.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findOpenByProject(projectId, options = {}) {
    return this.paginate(
      { project: projectId, status: { $in: ['open', 'acknowledged'] } },
      { sort: '-triggeredAt', ...options }
    );
  }

  // ── Status & Severity ─────────────────────────────────────────────────────────

  /**
   * Returns paginated alerts with the given status.
   *
   * @param {string} status
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByStatus(status, options = {}) {
    return this.paginate({ status }, { sort: '-triggeredAt', ...options });
  }

  /**
   * Returns paginated alerts with the given severity.
   *
   * @param {string} severity
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findBySeverity(severity, options = {}) {
    return this.paginate({ severity }, { sort: '-triggeredAt', ...options });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /**
   * Marks an alert as resolved, recording who resolved it and when.
   *
   * @param {string|mongoose.Types.ObjectId} alertId
   * @param {string|mongoose.Types.ObjectId|null} [resolvedBy]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  resolveAlert(alertId, resolvedBy = null) {
    const updateData = {
      status: 'resolved',
      resolvedAt: new Date(),
    };
    if (resolvedBy) {
      updateData.updatedBy = resolvedBy;
    }

    return this.model.findByIdAndUpdate(alertId, { $set: updateData }, { new: true });
  }

  /**
   * Assigns an alert to a user and sets its status to acknowledged.
   *
   * @param {string|mongoose.Types.ObjectId} alertId
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  assignAlert(alertId, userId) {
    return this.model.findByIdAndUpdate(
      alertId,
      { $set: { assignedTo: userId, status: 'acknowledged' } },
      { new: true }
    );
  }

  // ── Dashboard Statistics ──────────────────────────────────────────────────────

  /**
   * Returns per-severity and per-status counts for a project.
   * Used by the monitoring dashboard summary widget.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @returns {Promise<object>}
   */
  async getSummaryByProject(projectId) {
    const [severityCounts, statusCounts] = await Promise.all([
      this.model.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      this.model.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      bySeverity: Object.fromEntries(severityCounts.map(({ _id, count }) => [_id, count])),
      byStatus: Object.fromEntries(statusCounts.map(({ _id, count }) => [_id, count])),
    };
  }
}
