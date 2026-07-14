/**
 * @fileoverview Project routes — Phase 5 production implementation.
 *
 * All routes require a valid JWT access token via the `authenticate` middleware.
 * Write operations (create, update, delete, restore, members) also check project-level
 * ownership in the service layer (not via system-role `authorize` middleware).
 *
 * Registered endpoints:
 *   POST   /api/v1/projects                              (authenticated)
 *   GET    /api/v1/projects                              (authenticated)
 *   GET    /api/v1/projects/:projectId                   (authenticated)
 *   PATCH  /api/v1/projects/:projectId                   (authenticated — owner/admin)
 *   DELETE /api/v1/projects/:projectId                   (authenticated — owner/admin)
 *   PATCH  /api/v1/projects/:projectId/restore           (authenticated — owner/admin)
 *   POST   /api/v1/projects/:projectId/members           (authenticated — owner/admin)
 *   DELETE /api/v1/projects/:projectId/members/:userId   (authenticated — owner/admin)
 */

import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import {
  createProjectSchema,
  updateProjectSchema,
  assignMemberSchema,
  projectQuerySchema,
} from '../validators/project.validator.js';

const router = Router();

// Singleton controller instance — all methods are bound in the constructor
const projectController = new ProjectController();

// ── All project routes require authentication ─────────────────────────────────
router.use(authenticate);

// ── Collection Routes ─────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/projects
 * @desc    Create a new project; authenticated user becomes the owner
 * @access  Authenticated
 */
router.post('/', validate(createProjectSchema), catchAsync(projectController.createProject));

/**
 * @route   GET /api/v1/projects
 * @desc    List projects visible to the authenticated user
 *          Supports: ?page, ?limit, ?sortBy, ?sortOrder,
 *                    ?search, ?status, ?cloudProvider, ?environment,
 *                    ?owner, ?createdAfter, ?createdBefore
 * @access  Authenticated
 */
router.get('/', validate(projectQuerySchema, 'query'), catchAsync(projectController.getProjects));

// ── Document Routes ───────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/projects/:projectId
 * @desc    Get a project by ID (owner / member / admin)
 * @access  Authenticated
 */
router.get('/:projectId', catchAsync(projectController.getProjectById));

/**
 * @route   PATCH /api/v1/projects/:projectId
 * @desc    Partially update a project (owner / admin only)
 * @access  Authenticated
 */
router.patch(
  '/:projectId',
  validate(updateProjectSchema),
  catchAsync(projectController.updateProject)
);

/**
 * @route   DELETE /api/v1/projects/:projectId
 * @desc    Soft-delete a project (owner / admin only)
 * @access  Authenticated
 */
router.delete('/:projectId', catchAsync(projectController.deleteProject));

/**
 * @route   PATCH /api/v1/projects/:projectId/restore
 * @desc    Restore a soft-deleted project (owner / admin only)
 * @access  Authenticated
 */
router.patch('/:projectId/restore', catchAsync(projectController.restoreProject));

// ── Member Routes ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/projects/:projectId/members
 * @desc    Add a team member to the project (owner / admin only)
 * @access  Authenticated
 * @body    { userId: string }
 */
router.post(
  '/:projectId/members',
  validate(assignMemberSchema),
  catchAsync(projectController.assignMember)
);

/**
 * @route   DELETE /api/v1/projects/:projectId/members/:userId
 * @desc    Remove a team member from the project (owner / admin only)
 * @access  Authenticated
 */
router.delete('/:projectId/members/:userId', catchAsync(projectController.removeMember));

export default router;
