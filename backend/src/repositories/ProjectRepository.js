/**
 * @fileoverview ProjectRepository — data-access layer for Project documents.
 *
 * Extends BaseRepository with project-specific query methods:
 *   - Owner and team-member lookups
 *   - Team membership management
 *   - Population helpers for owner and team
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
}
