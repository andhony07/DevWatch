/**
 * @fileoverview BaseRepository — generic data-access abstraction for Mongoose models.
 *
 * All model-specific repositories extend this class and inherit a complete set
 * of CRUD, pagination, soft-delete, and existence-checking methods.
 *
 * Design principles:
 *   - No business logic — only data-access operations.
 *   - All methods are async/await; no callbacks.
 *   - `options` objects follow a consistent shape across methods.
 *   - Callers supply Mongoose filter objects; repositories do not interpret them.
 *   - Soft delete interacts with the softDeletePlugin query middleware automatically.
 */

import { APP_CONSTANTS } from '../constants/appConstants.js';

const { PAGINATION } = APP_CONSTANTS;

export class BaseRepository {
  /**
   * @param {import('mongoose').Model} model - The Mongoose model this repository manages
   */
  constructor(model) {
    this.model = model;
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  /**
   * Creates and persists a new document.
   *
   * @param {object} data - Field values for the new document
   * @returns {Promise<import('mongoose').Document>}
   */
  create(data) {
    const document = new this.model(data);
    return document.save();
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  /**
   * Finds a document by its MongoDB ObjectId.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} [options]
   * @param {string|object} [options.select] - Fields to include/exclude
   * @param {string|object[]} [options.populate] - Paths to populate
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findById(id, { select, populate } = {}) {
    let query = this.model.findById(id);
    if (select) {
      query = query.select(select);
    }
    if (populate) {
      const populations = Array.isArray(populate) ? populate : [populate];
      for (const p of populations) {
        query = query.populate(p);
      }
    }
    return query.exec();
  }

  /**
   * Finds the first document matching the given filter.
   *
   * @param {object} filter - Mongoose filter object
   * @param {object} [options]
   * @param {string|object} [options.select]
   * @param {string|object[]} [options.populate]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findOne(filter, { select, populate } = {}) {
    let query = this.model.findOne(filter);
    if (select) {
      query = query.select(select);
    }
    if (populate) {
      const populations = Array.isArray(populate) ? populate : [populate];
      for (const p of populations) {
        query = query.populate(p);
      }
    }
    return query.exec();
  }

  /**
   * Returns all documents matching the filter.
   *
   * @param {object} [filter={}]
   * @param {object} [options]
   * @param {string|object} [options.select]
   * @param {string|object[]} [options.populate]
   * @param {string|object} [options.sort='-createdAt']
   * @param {number} [options.limit]
   * @param {number} [options.skip]
   * @returns {Promise<import('mongoose').Document[]>}
   */
  findMany(filter = {}, { select, populate, sort = '-createdAt', limit, skip } = {}) {
    let query = this.model.find(filter);
    if (select) {
      query = query.select(select);
    }
    if (populate) {
      const populations = Array.isArray(populate) ? populate : [populate];
      for (const p of populations) {
        query = query.populate(p);
      }
    }
    if (sort) {
      query = query.sort(sort);
    }
    if (skip !== undefined) {
      query = query.skip(skip);
    }
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    return query.exec();
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  /**
   * Finds a document by ID, applies the given data, and returns the updated document.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} data - Fields to update (supports $set operators)
   * @param {object} [options]
   * @param {boolean} [options.new=true] - Return the updated document
   * @param {boolean} [options.runValidators=true] - Run schema validators on update
   * @returns {Promise<import('mongoose').Document|null>}
   */
  update(id, data, { new: returnNew = true, runValidators = true } = {}) {
    return this.model.findByIdAndUpdate(id, { $set: data }, { new: returnNew, runValidators });
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  /**
   * Permanently removes a document from the collection.
   * Use softDelete() for recoverable deletion.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  delete(id) {
    return this.model.findByIdAndDelete(id);
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────────

  /**
   * Performs a logical soft delete by setting isDeleted, deletedAt, and deletedBy.
   * Requires the softDeletePlugin to be applied to the model's schema.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {string|import('mongoose').Types.ObjectId|null} [deletedBy=null]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async softDelete(id, deletedBy = null) {
    const document = await this.model.findById(id);
    if (!document) {
      return null;
    }
    return document.softDelete(deletedBy);
  }

  /**
   * Restores a soft-deleted document.
   * Requires the softDeletePlugin to be applied to the model's schema.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async restore(id) {
    const document = await this.model.findById(id).setOptions({ includeDeleted: true });
    if (!document) {
      return null;
    }
    return document.restore();
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated result set with metadata.
   *
   * @param {object} [filter={}] - Mongoose filter object
   * @param {object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {string|object} [options.sort='-createdAt']
   * @param {string|object} [options.select]
   * @param {string|object[]} [options.populate]
   * @returns {Promise<{
   *   data: import('mongoose').Document[],
   *   pagination: {
   *     total: number,
   *     page: number,
   *     limit: number,
   *     totalPages: number,
   *     hasNextPage: boolean,
   *     hasPrevPage: boolean
   *   }
   * }>}
   */
  async paginate(
    filter = {},
    {
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
      sort = '-createdAt',
      select,
      populate,
    } = {}
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), PAGINATION.MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.findMany(filter, { select, populate, sort, skip, limit: safeLimit }),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / safeLimit);

    return {
      data,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

  // ── Existence & Count ─────────────────────────────────────────────────────────

  /**
   * Returns true if at least one document matches the filter.
   *
   * @param {object} filter
   * @returns {Promise<boolean>}
   */
  async exists(filter) {
    const result = await this.model.exists(filter);
    return result !== null;
  }

  /**
   * Returns the number of documents matching the filter.
   *
   * @param {object} [filter={}]
   * @returns {Promise<number>}
   */
  count(filter = {}) {
    return this.model.countDocuments(filter);
  }
}
