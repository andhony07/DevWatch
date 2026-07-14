/**
 * @fileoverview ProjectService — project management business logic.
 *
 * Orchestrates all project operations by coordinating:
 *   - ProjectRepository  (data access)
 *   - UserRepository     (member existence checks)
 *
 * This service contains NO HTTP concerns (no req/res/next).
 * All errors are thrown as ApiError instances for the error middleware to handle.
 *
 * RBAC rules enforced here (system role + project-level ownership):
 *   - admin      → full access to all projects
 *   - operator   → full access to own projects; read-only on projects they are a member of
 *   - viewer     → read-only on own projects and projects they are a member of
 *
 * Methods:
 *   createProject(dto, userId)
 *   getProjects(queryDto, userId, userRole)
 *   getProjectById(projectId, userId, userRole)
 *   updateProject(projectId, dto, userId, userRole)
 *   deleteProject(projectId, userId, userRole)
 *   restoreProject(projectId, userId, userRole)
 *   assignMember(projectId, memberId, requesterId, requesterRole)
 *   removeMember(projectId, memberId, requesterId, requesterRole)
 */

import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { ProjectResponseDTO } from '../dto/project/project.dto.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { logger } from '../config/logger.js';

const { ROLES } = APP_CONSTANTS;

export class ProjectService {
  /**
   * @param {ProjectRepository} [projectRepository] - Optional injection for testing
   * @param {UserRepository}    [userRepository]    - Optional injection for testing
   */
  constructor(projectRepository = new ProjectRepository(), userRepository = new UserRepository()) {
    this.projectRepo = projectRepository;
    this.userRepo = userRepository;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Returns true if the user is the project's owner.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @returns {boolean}
   */
  _isOwner(project, userId) {
    const ownerId = project.owner?._id ?? project.owner;
    return String(ownerId) === String(userId);
  }

  /**
   * Returns true if the user is a team member of the project.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @returns {boolean}
   */
  _isMember(project, userId) {
    return (
      project.teamMembers?.some((m) => {
        const memberId = m?._id ?? m;
        return String(memberId) === String(userId);
      }) ?? false
    );
  }

  /**
   * Returns true if the user can write to the project (admin or owner).
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @param {string} userRole
   * @returns {boolean}
   */
  _canWrite(project, userId, userRole) {
    return userRole === ROLES.ADMIN || this._isOwner(project, userId);
  }

  /**
   * Returns true if the user can read the project.
   * Admins see all; others only see projects they own or are a member of.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @param {string} userRole
   * @returns {boolean}
   */
  _canRead(project, userId, userRole) {
    if (userRole === ROLES.ADMIN) {
      return true;
    }
    return this._isOwner(project, userId) || this._isMember(project, userId);
  }

  /**
   * Asserts the authenticated user has write access to the project.
   * Throws ApiError.forbidden if not.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @param {string} userRole
   */
  _assertCanWrite(project, userId, userRole) {
    if (!this._canWrite(project, userId, userRole)) {
      throw ApiError.forbidden(MESSAGES.PROJECT.FORBIDDEN_WRITE);
    }
  }

  /**
   * Asserts the authenticated user can read the project.
   *
   * @param {import('mongoose').Document} project
   * @param {string} userId
   * @param {string} userRole
   */
  _assertCanRead(project, userId, userRole) {
    if (!this._canRead(project, userId, userRole)) {
      throw ApiError.forbidden(MESSAGES.PROJECT.FORBIDDEN_READ);
    }
  }

  // ── Create Project ────────────────────────────────────────────────────────────

  /**
   * Creates a new project owned by the authenticated user.
   *
   * @param {import('../dto/project/project.dto.js').CreateProjectDTO} dto
   * @param {string} userId - Authenticated user's ID
   * @returns {Promise<{ project: object }>}
   */
  async createProject(dto, userId) {
    // Duplicate name check per owner
    const isDuplicate = await this.projectRepo.existsByNameAndOwner(dto.name, userId);
    if (isDuplicate) {
      throw ApiError.conflict(MESSAGES.PROJECT.DUPLICATE_NAME);
    }

    const project = await this.projectRepo.create({
      name: dto.name,
      description: dto.description,
      repositoryUrl: dto.repositoryUrl,
      cloudProvider: dto.cloudProvider,
      environment: dto.environment,
      aiEnabled: dto.aiEnabled,
      tags: dto.tags,
      owner: userId,
      createdBy: userId,
      updatedBy: userId,
    });

    logger.info(`[ProjectService] Project created: "${dto.name}" by user ${userId}`);

    return { project: ProjectResponseDTO.fromDocument(project) };
  }

  // ── Get Projects ──────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of projects visible to the authenticated user.
   * Admins see all projects; other roles only see projects they own or are a member of.
   *
   * @param {import('../dto/project/project.dto.js').ProjectQueryDTO} queryDto
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ projects: object[]; pagination: object }>}
   */
  async getProjects(queryDto, userId, userRole) {
    const {
      page,
      limit,
      sortString,
      search,
      status,
      cloudProvider,
      environment,
      owner,
      createdAfter,
      createdBefore,
    } = queryDto;

    // Non-admins are scoped to projects they own or are a member of
    const scopeFilter =
      userRole === ROLES.ADMIN ? {} : { $or: [{ owner: userId }, { teamMembers: userId }] };

    const paginationOptions = {
      page,
      limit,
      sort: sortString,
      populate: [
        { path: 'owner', select: 'fullName email avatar role' },
        { path: 'teamMembers', select: 'fullName email avatar role' },
      ],
    };

    let result;

    if (search) {
      // Merge scope filter with search
      result = await this.projectRepo.search(search, scopeFilter, paginationOptions);
    } else {
      // Merge scope filter with explicit filters
      const filters = {
        status: status ?? undefined,
        cloudProvider: cloudProvider ?? undefined,
        environment: environment ?? undefined,
        owner: owner ?? undefined,
        createdAfter: createdAfter ?? undefined,
        createdBefore: createdBefore ?? undefined,
      };

      // For non-admins who also specify an owner filter, intersect the constraints.
      // We apply the scope filter directly inside findAllWithFilters.
      const combinedFilter = {
        ...filters,
        ...(userRole !== ROLES.ADMIN && { _scope: scopeFilter }),
      };

      result = await this._findProjectsWithScope(combinedFilter, scopeFilter, paginationOptions);
    }

    return {
      projects: ProjectResponseDTO.fromDocuments(result.data),
      pagination: result.pagination,
    };
  }

  /**
   * Internal helper that applies a scope filter alongside explicit filters.
   *
   * @param {object} filters
   * @param {object} scopeFilter
   * @param {object} options
   * @returns {Promise<object>}
   */
  _findProjectsWithScope(filters, scopeFilter, options) {
    const { _scope, ...cleanFilters } = filters;

    // Build a clean Mongoose filter
    const mongoFilter = {};

    if (cleanFilters.status) {
      mongoFilter.status = cleanFilters.status;
    }
    if (cleanFilters.cloudProvider) {
      mongoFilter.cloudProvider = cleanFilters.cloudProvider;
    }
    if (cleanFilters.environment) {
      mongoFilter.environment = cleanFilters.environment;
    }
    if (cleanFilters.owner) {
      mongoFilter.owner = cleanFilters.owner;
    }

    if (cleanFilters.createdAfter || cleanFilters.createdBefore) {
      mongoFilter.createdAt = {};
      if (cleanFilters.createdAfter) {
        mongoFilter.createdAt.$gte = cleanFilters.createdAfter;
      }
      if (cleanFilters.createdBefore) {
        mongoFilter.createdAt.$lte = cleanFilters.createdBefore;
      }
    }

    // Apply scope filter only if non-admin
    if (_scope && Object.keys(scopeFilter).length > 0) {
      // If there's also an owner filter AND scope, use $and to combine them
      if (mongoFilter.owner && scopeFilter.$or) {
        const andClauses = [{ owner: mongoFilter.owner }, scopeFilter];
        delete mongoFilter.owner;
        mongoFilter.$and = andClauses;
      } else if (scopeFilter.$or) {
        mongoFilter.$or = scopeFilter.$or;
      }
    }

    return this.projectRepo.paginate(mongoFilter, options);
  }

  // ── Get Project By ID ─────────────────────────────────────────────────────────

  /**
   * Returns a single project by its ID.
   * Access is limited to admins, the project owner, and team members.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ project: object }>}
   */
  async getProjectById(projectId, userId, userRole) {
    const project = await this.projectRepo.findWithTeam(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    this._assertCanRead(project, userId, userRole);

    return { project: ProjectResponseDTO.fromDocument(project) };
  }

  // ── Update Project ────────────────────────────────────────────────────────────

  /**
   * Partially updates a project.
   * Only the owner or an admin can update a project.
   * Enforces duplicate name check if the name is being changed.
   *
   * @param {string} projectId
   * @param {import('../dto/project/project.dto.js').UpdateProjectDTO} dto
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ project: object }>}
   */
  async updateProject(projectId, dto, userId, userRole) {
    const project = await this.projectRepo.findById(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    this._assertCanWrite(project, userId, userRole);

    const payload = dto.toUpdatePayload();

    // If the name is changing, check for duplicates
    if (payload.name && payload.name.toLowerCase() !== project.name.toLowerCase()) {
      const isDuplicate = await this.projectRepo.existsByNameAndOwner(
        payload.name,
        project.owner,
        projectId
      );
      if (isDuplicate) {
        throw ApiError.conflict(MESSAGES.PROJECT.DUPLICATE_NAME);
      }
    }

    payload.updatedBy = userId;

    const updated = await this.projectRepo.update(projectId, payload);

    if (!updated) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    logger.info(`[ProjectService] Project updated: ${projectId} by user ${userId}`);

    return { project: ProjectResponseDTO.fromDocument(updated) };
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────────

  /**
   * Soft-deletes a project (sets isDeleted: true).
   * Only the owner or an admin can delete a project.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<void>}
   */
  async deleteProject(projectId, userId, userRole) {
    const project = await this.projectRepo.findById(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    this._assertCanWrite(project, userId, userRole);

    await this.projectRepo.softDelete(projectId, userId);

    logger.info(`[ProjectService] Project soft-deleted: ${projectId} by user ${userId}`);
  }

  // ── Restore ───────────────────────────────────────────────────────────────────

  /**
   * Restores a soft-deleted project.
   * Only the owner or an admin can restore a project.
   *
   * @param {string} projectId
   * @param {string} userId
   * @param {string} userRole
   * @returns {Promise<{ project: object }>}
   */
  async restoreProject(projectId, userId, userRole) {
    const project = await this.projectRepo.findByIdIncludeDeleted(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    if (!project.isDeleted) {
      throw ApiError.badRequest(MESSAGES.PROJECT.RESTORE_NOT_DELETED);
    }

    this._assertCanWrite(project, userId, userRole);

    const restored = await this.projectRepo.restore(projectId);

    if (!restored) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    logger.info(`[ProjectService] Project restored: ${projectId} by user ${userId}`);

    return { project: ProjectResponseDTO.fromDocument(restored) };
  }

  // ── Assign Member ─────────────────────────────────────────────────────────────

  /**
   * Adds a user to the project's teamMembers array.
   * Only the project owner or an admin can assign members.
   *
   * @param {string} projectId
   * @param {string} memberId - The ID of the user to add
   * @param {string} requesterId - The authenticated user's ID
   * @param {string} requesterRole - The authenticated user's system role
   * @returns {Promise<{ project: object }>}
   */
  async assignMember(projectId, memberId, requesterId, requesterRole) {
    const project = await this.projectRepo.findWithTeam(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    this._assertCanWrite(project, requesterId, requesterRole);

    // Verify the target user exists
    const targetUser = await this.userRepo.findSafeById(memberId);
    if (!targetUser) {
      throw ApiError.notFound(MESSAGES.PROJECT.MEMBER_NOT_FOUND);
    }

    // Prevent adding the owner as a team member
    if (this._isOwner(project, memberId)) {
      throw ApiError.conflict(MESSAGES.PROJECT.CANNOT_REMOVE_OWNER);
    }

    // Idempotency check — already a member?
    if (this._isMember(project, memberId)) {
      throw ApiError.conflict(MESSAGES.PROJECT.MEMBER_ALREADY_EXISTS);
    }

    const updated = await this.projectRepo.addTeamMember(projectId, memberId);

    logger.info(
      `[ProjectService] Member ${memberId} added to project ${projectId} by ${requesterId}`
    );

    return { project: ProjectResponseDTO.fromDocument(updated) };
  }

  // ── Remove Member ─────────────────────────────────────────────────────────────

  /**
   * Removes a user from the project's teamMembers array.
   * Only the project owner or an admin can remove members.
   *
   * @param {string} projectId
   * @param {string} memberId - The ID of the user to remove
   * @param {string} requesterId - The authenticated user's ID
   * @param {string} requesterRole - The authenticated user's system role
   * @returns {Promise<{ project: object }>}
   */
  async removeMember(projectId, memberId, requesterId, requesterRole) {
    const project = await this.projectRepo.findWithTeam(projectId);

    if (!project) {
      throw ApiError.notFound(MESSAGES.PROJECT.NOT_FOUND);
    }

    this._assertCanWrite(project, requesterId, requesterRole);

    // Cannot remove the owner from team members
    if (this._isOwner(project, memberId)) {
      throw ApiError.badRequest(MESSAGES.PROJECT.CANNOT_REMOVE_OWNER);
    }

    // User must actually be a member
    if (!this._isMember(project, memberId)) {
      throw ApiError.notFound(MESSAGES.PROJECT.MEMBER_NOT_IN_PROJECT);
    }

    const updated = await this.projectRepo.removeTeamMember(projectId, memberId);

    logger.info(
      `[ProjectService] Member ${memberId} removed from project ${projectId} by ${requesterId}`
    );

    return { project: ProjectResponseDTO.fromDocument(updated) };
  }
}
