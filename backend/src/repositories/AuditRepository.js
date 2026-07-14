/**
 * @fileoverview AuditRepository — data-access layer for AuditLog documents.
 *
 * Extends BaseRepository with audit-trail–specific query methods:
 *   - Per-user and per-resource audit history
 *   - Action-type and time-range filtering
 *   - Convenience logAction factory wrapper
 *
 * AuditLog records are append-only. This repository exposes no update or delete methods.
 * Soft delete is intentionally not supported on audit logs.
 */

import { BaseRepository } from './BaseRepository.js';
import { AuditLog } from '../models/index.js';

export class AuditRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  // ── Logging ───────────────────────────────────────────────────────────────────

  /**
   * Creates a new audit log entry using the static factory on the model.
   * Prefer this over BaseRepository.create() for consistent log creation.
   *
   * @param {object} params
   * @param {string|import('mongoose').Types.ObjectId} params.userId
   * @param {string} params.action
   * @param {string} params.resource
   * @param {string|import('mongoose').Types.ObjectId|null} [params.resourceId]
   * @param {string|null} [params.ipAddress]
   * @param {string|null} [params.userAgent]
   * @param {object|null} [params.metadata]
   * @returns {Promise<import('mongoose').Document>}
   */
  logAction({
    userId,
    action,
    resource,
    resourceId = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
  }) {
    return AuditLog.logAction({
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /**
   * Returns paginated audit logs for a specific user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByUser(userId, options = {}) {
    return this.paginate({ user: userId }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns paginated audit logs for a specific resource type and instance.
   *
   * @param {string} resource
   * @param {string|import('mongoose').Types.ObjectId} resourceId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByResource(resource, resourceId, options = {}) {
    return this.paginate({ resource, resourceId }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns paginated audit logs for a specific action type with optional time range.
   *
   * @param {string} action
   * @param {object} [options]
   * @param {Date} [options.from]
   * @param {Date} [options.to]
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @returns {Promise<object>} Paginated result
   */
  findByAction(action, { from, to, page, limit } = {}) {
    const filter = { action };
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        filter.createdAt.$gte = from;
      }
      if (to) {
        filter.createdAt.$lte = to;
      }
    }
    return this.paginate(filter, { sort: '-createdAt', page, limit });
  }

  /**
   * Returns audit logs for a user filtered by resource type.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} resource
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByUserAndResource(userId, resource, options = {}) {
    return this.paginate({ user: userId, resource }, { sort: '-createdAt', ...options });
  }

  // ── BaseRepository override — guard against mutation ─────────────────────────

  /**
   * Intentionally disabled: audit log records must not be updated.
   * Throws an error if called.
   *
   * @throws {Error}
   */
  update() {
    throw new Error('AuditLog records are immutable and cannot be updated.');
  }

  /**
   * Intentionally disabled: audit log records must not be permanently deleted
   * except by scheduled retention-policy jobs operating at the database level.
   *
   * @throws {Error}
   */
  delete() {
    throw new Error('AuditLog records cannot be deleted through the repository layer.');
  }

  /**
   * Intentionally disabled: soft delete is not supported on audit logs.
   *
   * @throws {Error}
   */
  softDelete() {
    throw new Error('AuditLog records do not support soft delete.');
  }
}
