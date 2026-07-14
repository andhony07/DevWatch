/**
 * @fileoverview Reusable Mongoose soft-delete plugin.
 *
 * Adds three fields to any schema it is applied to:
 *   - isDeleted   {Boolean} — logical deletion flag (default: false)
 *   - deletedAt   {Date}    — timestamp of the soft delete
 *   - deletedBy   {ObjectId}— user who performed the soft delete
 *
 * Query behaviour after plugin application:
 *   - find, findOne, findOneAndUpdate, countDocuments automatically
 *     exclude { isDeleted: true } unless the caller explicitly passes
 *     { includeDeleted: true } in the query options or filter.
 *
 * Instance methods added:
 *   - softDelete(deletedBy)  — marks the document as deleted
 *   - restore()              — reverses the soft delete
 *
 * Static methods added:
 *   - findDeleted(filter)    — returns only soft-deleted documents
 *   - findWithDeleted(filter)— returns all documents regardless of deletion state
 */

import mongoose from 'mongoose';

/**
 * Applies soft-delete behaviour to a Mongoose schema.
 *
 * @param {mongoose.Schema} schema - The schema to augment
 * @returns {void}
 */
export const softDeletePlugin = (schema) => {
  // ── Fields ──────────────────────────────────────────────────────────────────

  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  });

  // ── Query Middleware ─────────────────────────────────────────────────────────

  /**
   * Injects { isDeleted: false } into every find/count query unless the
   * caller passes { includeDeleted: true } as a query option.
   */
  const excludeDeleted = function () {
    if (!this.getOptions().includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('count', excludeDeleted);

  // ── Instance Methods ─────────────────────────────────────────────────────────

  /**
   * Marks this document as soft-deleted.
   *
   * @param {mongoose.Types.ObjectId|string|null} [deletedBy=null] - ID of the user performing the action
   * @returns {Promise<this>}
   */
  schema.methods.softDelete = function (deletedBy = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    return this.save();
  };

  /**
   * Restores a soft-deleted document back to active state.
   *
   * @returns {Promise<this>}
   */
  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  // ── Static Methods ───────────────────────────────────────────────────────────

  /**
   * Returns only soft-deleted documents matching the given filter.
   *
   * @param {object} [filter={}]
   * @returns {mongoose.Query}
   */
  schema.statics.findDeleted = function (filter = {}) {
    return this.find({ ...filter, isDeleted: true }).setOptions({ includeDeleted: true });
  };

  /**
   * Returns all documents regardless of their deletion state.
   *
   * @param {object} [filter={}]
   * @returns {mongoose.Query}
   */
  schema.statics.findWithDeleted = function (filter = {}) {
    return this.find(filter).setOptions({ includeDeleted: true });
  };
};
