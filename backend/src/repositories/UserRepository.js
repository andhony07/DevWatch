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

  // ── Refresh Token ─────────────────────────────────────────────────────────────

  /**
   * Stores a hashed refresh token for the given user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} hashedToken - bcrypt hash of the raw refresh token
   * @returns {Promise<import('mongoose').Document|null>}
   */
  storeRefreshToken(userId, hashedToken) {
    return this.model.findByIdAndUpdate(
      userId,
      { $set: { refreshToken: hashedToken } },
      { new: true, runValidators: false }
    );
  }

  /**
   * Finds a user that has the given hashed refresh token stored.
   * Explicitly selects the refreshToken field (excluded by default).
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByIdWithRefreshToken(userId) {
    return this.model.findById(userId).select('+refreshToken');
  }

  /**
   * Clears the stored refresh token for a user (logout / invalidation).
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  clearRefreshToken(userId) {
    return this.model.findByIdAndUpdate(
      userId,
      { $set: { refreshToken: null } },
      { new: true, runValidators: false }
    );
  }

  // ── Password Reset ────────────────────────────────────────────────────────────

  /**
   * Stores a hashed password reset token and its expiry date.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} hashedToken
   * @param {Date} expires
   * @returns {Promise<import('mongoose').Document|null>}
   */
  setPasswordResetToken(userId, hashedToken, expires) {
    return this.model.findByIdAndUpdate(
      userId,
      { $set: { passwordResetToken: hashedToken, passwordResetExpires: expires } },
      { new: true, runValidators: false }
    );
  }

  /**
   * Finds a user by their hashed password reset token, including token fields.
   * Also checks that the token has not yet expired.
   *
   * @param {string} hashedToken
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByPasswordResetToken(hashedToken) {
    return this.model
      .findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordResetToken +password');
  }

  /**
   * Clears the password reset token fields after a successful reset.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  clearPasswordResetToken(userId) {
    return this.model.findByIdAndUpdate(
      userId,
      { $set: { passwordResetToken: null, passwordResetExpires: null } },
      { new: true, runValidators: false }
    );
  }

  // ── Email Verification ────────────────────────────────────────────────────────

  /**
   * Stores a hashed email verification token and its expiry.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} hashedToken
   * @param {Date} expires
   * @returns {Promise<import('mongoose').Document|null>}
   */
  setEmailVerificationToken(userId, hashedToken, expires) {
    return this.model.findByIdAndUpdate(
      userId,
      {
        $set: {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: expires,
        },
      },
      { new: true, runValidators: false }
    );
  }

  /**
   * Finds a user by their hashed email verification token.
   * Only returns users with a non-expired token.
   *
   * @param {string} hashedToken
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByEmailVerificationToken(hashedToken) {
    return this.model
      .findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() },
      })
      .select('+emailVerificationToken');
  }

  /**
   * Marks the user's email as verified and clears the verification token.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  verifyEmail(userId) {
    return this.model.findByIdAndUpdate(
      userId,
      {
        $set: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      },
      { new: true, runValidators: false }
    );
  }
}
