/**
 * @fileoverview ProjectController — thin HTTP adapter for the ProjectService.
 *
 * Responsibilities:
 *   - Extract validated data from req.body / req.params / req.query
 *   - Build DTOs and delegate to ProjectService
 *   - Return standardized ApiResponse envelopes
 *   - Never contain business logic
 *
 * All methods are wrapped with catchAsync by the router.
 * Errors thrown by ProjectService propagate to the global error middleware.
 *
 * req.user is populated by the `authenticate` middleware and has shape:
 *   { sub: string, role: string, email: string, iat: number, exp: number }
 */

import { ProjectService } from '../services/project.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  CreateProjectDTO,
  UpdateProjectDTO,
  AssignMemberDTO,
  ProjectQueryDTO,
} from '../dto/project/project.dto.js';
import { MESSAGES } from '../constants/messages.js';

export class ProjectController {
  /**
   * @param {ProjectService} [projectService] - Optional injection for testing
   */
  constructor(projectService = new ProjectService()) {
    this.projectService = projectService;

    // Bind all methods so they survive router destructuring
    this.createProject = this.createProject.bind(this);
    this.getProjects = this.getProjects.bind(this);
    this.getProjectById = this.getProjectById.bind(this);
    this.updateProject = this.updateProject.bind(this);
    this.deleteProject = this.deleteProject.bind(this);
    this.restoreProject = this.restoreProject.bind(this);
    this.assignMember = this.assignMember.bind(this);
    this.removeMember = this.removeMember.bind(this);
  }

  // ── POST /projects ────────────────────────────────────────────────────────────

  /**
   * Creates a new project. The authenticated user becomes the owner automatically.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createProject(req, res) {
    const dto = CreateProjectDTO.fromRequest(req.body);
    const { project } = await this.projectService.createProject(dto, req.user.sub);
    return ApiResponse.created(res, MESSAGES.PROJECT.CREATED, { project });
  }

  // ── GET /projects ─────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of projects visible to the authenticated user.
   * Supports search, filtering, sorting, and pagination via query parameters.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getProjects(req, res) {
    const queryDto = ProjectQueryDTO.fromRequest(req.query);
    const { projects, pagination } = await this.projectService.getProjects(
      queryDto,
      req.user.sub,
      req.user.role
    );

    return ApiResponse.ok(res, MESSAGES.PROJECT.LIST_FETCHED, { projects }, pagination);
  }

  // ── GET /projects/:projectId ──────────────────────────────────────────────────

  /**
   * Returns a single project by its ID.
   * Access is enforced by the service layer (admin / owner / member).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getProjectById(req, res) {
    const { projectId } = req.params;
    const { project } = await this.projectService.getProjectById(
      projectId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.PROJECT.FETCHED, { project });
  }

  // ── PATCH /projects/:projectId ────────────────────────────────────────────────

  /**
   * Partially updates a project. Owner and admin only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async updateProject(req, res) {
    const { projectId } = req.params;
    const dto = UpdateProjectDTO.fromRequest(req.body);
    const { project } = await this.projectService.updateProject(
      projectId,
      dto,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.PROJECT.UPDATED, { project });
  }

  // ── DELETE /projects/:projectId ───────────────────────────────────────────────

  /**
   * Soft-deletes a project. Owner and admin only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deleteProject(req, res) {
    const { projectId } = req.params;
    await this.projectService.deleteProject(projectId, req.user.sub, req.user.role);
    return ApiResponse.ok(res, MESSAGES.PROJECT.DELETED);
  }

  // ── PATCH /projects/:projectId/restore ───────────────────────────────────────

  /**
   * Restores a soft-deleted project. Owner and admin only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async restoreProject(req, res) {
    const { projectId } = req.params;
    const { project } = await this.projectService.restoreProject(
      projectId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.PROJECT.RESTORED, { project });
  }

  // ── POST /projects/:projectId/members ─────────────────────────────────────────

  /**
   * Adds a team member to the project. Owner and admin only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async assignMember(req, res) {
    const { projectId } = req.params;
    const dto = AssignMemberDTO.fromRequest(req.body);
    const { project } = await this.projectService.assignMember(
      projectId,
      dto.userId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.PROJECT.MEMBER_ADDED, { project });
  }

  // ── DELETE /projects/:projectId/members/:userId ───────────────────────────────

  /**
   * Removes a team member from the project. Owner and admin only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async removeMember(req, res) {
    const { projectId, userId } = req.params;
    const { project } = await this.projectService.removeMember(
      projectId,
      userId,
      req.user.sub,
      req.user.role
    );
    return ApiResponse.ok(res, MESSAGES.PROJECT.MEMBER_REMOVED, { project });
  }
}
