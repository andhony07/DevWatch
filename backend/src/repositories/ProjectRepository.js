/**
 * @fileoverview ProjectRepository — data-access layer for Project documents.
 *
 * Extends BaseRepository with project-specific query methods:
 *   - Owner and team-member lookups
 *   - Team membership management
 *   - Population helpers for owner and team
 *   - Full-text search across name / description / repositoryUrl / tags
 *   - Combined filter + pagination queries for the list endpoint
 *   - Duplicate name checking per owner
 *   - Soft-delete-aware restore lookup
 */

import { BaseRepository } from './BaseRepository.js';
import { Project } from '../models/index.js';

export class ProjectRepository extends BaseRepository {
  constructor() {
    super(Project);
  }

  // ── Ownership & Membership ────────────────────────────────────────────────────

  /**
   * Returns all active projects owned by the given user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options] - Pagination options passed to BaseRepository.paginate
   * @returns {Promise<object>} Paginated result
   */
  findByOwner(userId, options = {}) {
    return this.paginate({ owner: userId, status: 'active' }, { sort: '-createdAt', ...options });
  }

  /**
   * Returns all active projects where the user is a team member (but not the owner).
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByMember(userId, options = {}) {
    return this.paginate(
      { teamMembers: userId, owner: { $ne: userId }, status: 'active' },
      { sort: '-createdAt', ...options }
    );
  }

  /**
   * Returns all projects the user is associated with — as owner or team member.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByUser(userId, options = {}) {
    return this.paginate(
      { $or: [{ owner: userId }, { teamMembers: userId }], status: 'active' },
      { sort: '-createdAt', ...options }
    );
  }

  // ── Team Management ───────────────────────────────────────────────────────────

  /**
   * Adds a user to the project's teamMembers array (idempotent).
   *
   * @param {string|import('mongoose').Types.ObjectId} projectId
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  addTeamMember(projectId, userId) {
    return this.model.findByIdAndUpdate(
      projectId,
      { $addToSet: { teamMembers: userId } },
      { new: true }
    );
  }

  /**
   * Removes a user from the project's teamMembers array.
   *
   * @param {string|import('mongoose').Types.ObjectId} projectId
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  removeTeamMember(projectId, userId) {
    return this.model.findByIdAndUpdate(
      projectId,
      { $pull: { teamMembers: userId } },
      { new: true }
    );
  }

  // ── Rich Queries ──────────────────────────────────────────────────────────────

  /**
   * Returns a project by ID with its owner and teamMembers fully populated.
   *
   * @param {string|import('mongoose').Types.ObjectId} projectId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findWithTeam(projectId) {
    return this.findById(projectId, {
      populate: [
        { path: 'owner', select: 'fullName email avatar role' },
        { path: 'teamMembers', select: 'fullName email avatar role' },
      ],
    });
  }

  /**
   * Returns projects filtered by cloud provider and/or environment.
   *
   * @param {object} filter
   * @param {string} [filter.cloudProvider]
   * @param {string} [filter.environment]
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByProviderAndEnvironment({ cloudProvider, environment } = {}, options = {}) {
    const query = { status: 'active' };
    if (cloudProvider) {
      query.cloudProvider = cloudProvider;
    }
    if (environment) {
      query.environment = environment;
    }
    return this.paginate(query, { sort: '-createdAt', ...options });
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  /**
   * Full-text search across name, description, repositoryUrl, and tags.
   * Uses case-insensitive regex queries.
   *
   * @param {string} searchTerm - Raw search string from the user
   * @param {object} [additionalFilter={}] - Merged with the search filter
   * @param {object} [options={}] - Pagination / sort options
   * @returns {Promise<object>} Paginated result
   */
  search(searchTerm, additionalFilter = {}, options = {}) {
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const searchFilter = {
      $or: [{ name: regex }, { description: regex }, { repositoryUrl: regex }, { tags: regex }],
      ...additionalFilter,
    };

    return this.paginate(searchFilter, { sort: '-createdAt', ...options });
  }

  // ── Combined Filter + Pagination ──────────────────────────────────────────────

  /**
   * Resolves a set of filter parameters into a MongoDB filter object and paginates.
   *
   * Supported filters: status, cloudProvider, environment, owner,
   *                    createdAfter, createdBefore
   *
   * @param {object} filters
   * @param {string|null} [filters.status]
   * @param {string|null} [filters.cloudProvider]
   * @param {string|null} [filters.environment]
   * @param {string|null} [filters.owner]
   * @param {Date|null}   [filters.createdAfter]
   * @param {Date|null}   [filters.createdBefore]
   * @param {object} [options={}] - Pagination / sort options
   * @returns {Promise<object>} Paginated result
   */
  findAllWithFilters(
    { status, cloudProvider, environment, owner, createdAfter, createdBefore } = {},
    options = {}
  ) {
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (cloudProvider) {
      filter.cloudProvider = cloudProvider;
    }
    if (environment) {
      filter.environment = environment;
    }
    if (owner) {
      filter.owner = owner;
    }

    if (createdAfter || createdBefore) {
      filter.createdAt = {};
      if (createdAfter) {
        filter.createdAt.$gte = createdAfter;
      }
      if (createdBefore) {
        filter.createdAt.$lte = createdBefore;
      }
    }

    return this.paginate(filter, options);
  }

  // ── Duplicate Check ───────────────────────────────────────────────────────────

  /**
   * Returns true if a project with the given name already exists for the same owner.
   * Optionally excludes a specific project ID (useful for update operations).
   *
   * @param {string} name - Project name (case-insensitive comparison)
   * @param {string|import('mongoose').Types.ObjectId} ownerId
   * @param {string|import('mongoose').Types.ObjectId|null} [excludeId=null]
   * @returns {Promise<boolean>}
   */
  existsByNameAndOwner(name, ownerId, excludeId = null) {
    const filter = {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      owner: ownerId,
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  // ── Soft-Delete Aware Lookup ──────────────────────────────────────────────────

  /**
   * Finds a project by ID including soft-deleted documents.
   * Required by the restore flow (the project won't appear in normal queries).
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByIdIncludeDeleted(id) {
    return this.model.findById(id).setOptions({ includeDeleted: true }).exec();
  }

  /**
   * Finds a project by ID with team populated, including soft-deleted documents.
   *
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findByIdWithTeamIncludeDeleted(id) {
    return this.model
      .findById(id)
      .setOptions({ includeDeleted: true })
      .populate([
        { path: 'owner', select: 'fullName email avatar role' },
        { path: 'teamMembers', select: 'fullName email avatar role' },
      ])
      .exec();
  }
}
