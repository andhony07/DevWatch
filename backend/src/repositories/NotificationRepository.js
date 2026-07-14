/**
 * @fileoverview NotificationRepository — data-access layer for Notification documents.
 *
 * Extends BaseRepository with notification-specific query methods:
 *   - Per-user inbox queries
 *   - Unread count
 *   - Bulk mark-as-read
 *   - Delivered state updates
 */

import { BaseRepository } from './BaseRepository.js';
import { Notification } from '../models/index.js';

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  // ── Inbox Queries ─────────────────────────────────────────────────────────────

  /**
   * Returns paginated notifications for a user, newest first.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByRecipient(userId, options = {}) {
    return this.paginate({ recipient: userId }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns paginated unread notifications for a user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findUnread(userId, options = {}) {
    return this.paginate({ recipient: userId, read: false }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns the count of unread notifications for a user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<number>}
   */
  countUnread(userId) {
    return this.count({ recipient: userId, read: false });
  }

  // ── State Updates ─────────────────────────────────────────────────────────────

  /**
   * Marks a single notification as read.
   *
   * @param {string|import('mongoose').Types.ObjectId} notificationId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  markAsRead(notificationId) {
    return this.update(notificationId, { read: true });
  }

  /**
   * Marks all unread notifications for a user as read in a single operation.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    const result = await this.model.updateMany(
      { recipient: userId, read: false },
      { $set: { read: true } }
    );
    return result.modifiedCount;
  }

  /**
   * Marks a notification as delivered (e.g., sent via email or push).
   *
   * @param {string|import('mongoose').Types.ObjectId} notificationId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  markDelivered(notificationId) {
    return this.update(notificationId, { delivered: true });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  /**
   * Deletes all read notifications for a user older than the given date.
   * Useful for mailbox cleanup jobs.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {Date} olderThan
   * @returns {Promise<number>} Number of deleted notifications
   */
  async deleteReadOlderThan(userId, olderThan) {
    const result = await this.model.deleteMany({
      recipient: userId,
      read: true,
      createdAt: { $lt: olderThan },
    });
    return result.deletedCount;
  }
}
