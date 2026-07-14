/**
 * @fileoverview UserRepository — data-access layer for User documents.
 *
 * Extends BaseRepository with user-specific query methods:
 *   - Authentication lookups (with password field)
 *   - Last-login recording
 *   - Password updates
 *   - Active-user filtering
 */

import { BaseRepository } from './BaseRepository.js';
import { User } from '../models/index.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  // ── Authentication ────────────────────────────────────────────────────────────

  /**
   * Finds a user by email address, explicitly including the password hash.
   * Use only in authentication flows.
   *
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByEmail(email) {
    return this.model.findOne({ email: email.toLowerCase().trim() }).select('+password');
  }

  /**
   * Checks whether a user with the given email exists (without loading the document).
   *
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  emailExists(email) {
    return this.exists({ email: email.toLowerCase().trim() });
  }

  // ── Profile ────────────────────────────────────────────────────────────────────

  /**
   * Updates the lastLogin timestamp for the given user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  updateLastLogin(userId) {
    return this.update(userId, { lastLogin: new Date() });
  }

  /**
   * Updates the hashed password for a user.
   * NOTE: Raw password hashing is handled by the User model pre-save hook.
   * Pass the plain-text password here only when the user document is being saved via `save()`.
   * When updating directly (bypassing the hook), pass the pre-hashed value.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} hashedPassword - bcryptjs hash of the new password
   * @returns {Promise<import('mongoose').Document|null>}
   */
  updatePassword(userId, hashedPassword) {
    return this.model.findByIdAndUpdate(
      userId,
      { $set: { password: hashedPassword } },
      { new: true, runValidators: false } // Skip validators: hash bypasses minlength
    );
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /**
   * Returns all active, non-deleted users ordered by creation date.
   *
   * @param {object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<object>} Paginated result
   */
  findActiveUsers(options = {}) {
    return this.paginate({ status: 'active' }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns all users with the specified role.
   *
   * @param {string} role
   * @returns {Promise<import('mongoose').Document[]>}
   */
  findByRole(role) {
    return this.findMany({ role, status: 'active' });
  }

  /**
   * Finds a user by ID without the password field (safe for public responses).
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findSafeById(id) {
    return this.findById(id, { select: '-password' });
  }
}
