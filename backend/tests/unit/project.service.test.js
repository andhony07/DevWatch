/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/**
 * @fileoverview Unit tests for ProjectService.
 *
 * All external dependencies (ProjectRepository, UserRepository, logger) are mocked
 * so these tests run without a live MongoDB connection.
 *
 * Test scenarios:
 *   createProject   — success, duplicate name (409)
 *   getProjects     — admin sees all, non-admin scoped, search path
 *   getProjectById  — success, not found (404), forbidden (403)
 *   updateProject   — success, not found, forbidden, duplicate name
 *   deleteProject   — success, not found, forbidden
 *   restoreProject  — success, not found, not deleted, forbidden
 *   assignMember    — success, project not found, user not found, already member, is owner
 *   removeMember    — success, project not found, not a member, is owner
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://localhost:27017/devwatch_test';
process.env.JWT_SECRET = 'test_access_secret_key_minimum_32_characters';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_minimum_32_chars';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '30d';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.SOCKET_PORT = '5000';

import { jest } from '@jest/globals';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Dynamic Imports (after mocks are registered) ──────────────────────────────
const { ProjectService } = await import('../../src/services/project.service.js');
const { ApiError } = await import('../../src/utils/ApiError.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADMIN_ROLE = 'admin';
const OPERATOR_ROLE = 'operator';
const VIEWER_ROLE = 'viewer';

const OWNER_ID = 'aaaa00000000000000000001';
const OTHER_ID = 'bbbb00000000000000000002';
const MEMBER_ID = 'cccc00000000000000000003';
const PROJECT_ID = 'dddd00000000000000000004';

/**
 * Builds a minimal mock ProjectRepository with all methods as jest.fn().
 */
const createMockProjectRepo = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByIdIncludeDeleted: jest.fn(),
  findWithTeam: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  addTeamMember: jest.fn(),
  removeTeamMember: jest.fn(),
  existsByNameAndOwner: jest.fn(),
  paginate: jest.fn(),
  search: jest.fn(),
});

/**
 * Builds a minimal mock UserRepository.
 */
const createMockUserRepo = () => ({
  findSafeById: jest.fn(),
});

/**
 * Builds a mock Project document.
 */
const buildMockProject = (overrides = {}) => {
  const base = {
    _id: PROJECT_ID,
    id: PROJECT_ID,
    name: 'DevWatch API',
    description: 'Main API project',
    owner: OWNER_ID,
    teamMembers: [],
    repositoryUrl: null,
    cloudProvider: 'aws',
    environment: 'production',
    status: 'active',
    aiEnabled: false,
    tags: [],
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  base.toJSON = jest.fn().mockReturnValue(base);
  return base;
};

/**
 * Builds a mock User document.
 */
const buildMockUser = (overrides = {}) => ({
  _id: MEMBER_ID,
  id: MEMBER_ID,
  fullName: 'New Member',
  email: 'member@devwatch.io',
  role: OPERATOR_ROLE,
  toJSON: jest.fn().mockReturnValue({ id: MEMBER_ID }),
  ...overrides,
});

// ── createProject ─────────────────────────────────────────────────────────────

describe('ProjectService.createProject', () => {
  it('creates a project and returns ProjectResponseDTO', async () => {
    const projectRepo = createMockProjectRepo();
    const userRepo = createMockUserRepo();
    const mockProject = buildMockProject();

    projectRepo.existsByNameAndOwner.mockResolvedValue(false);
    projectRepo.create.mockResolvedValue(mockProject);

    const service = new ProjectService(projectRepo, userRepo);
    const dto = {
      name: 'DevWatch API',
      description: null,
      repositoryUrl: null,
      cloudProvider: 'aws',
      environment: 'production',
      aiEnabled: false,
      tags: [],
    };

    const result = await service.createProject(dto, OWNER_ID);

    expect(projectRepo.existsByNameAndOwner).toHaveBeenCalledWith('DevWatch API', OWNER_ID);
    expect(projectRepo.create).toHaveBeenCalled();
    expect(result.project).toBeDefined();
    expect(result.project.name).toBe('DevWatch API');
  });

  it('throws 409 when project name already exists for the same owner', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.existsByNameAndOwner.mockResolvedValue(true);

    const service = new ProjectService(projectRepo, createMockUserRepo());

    await expect(
      service.createProject({ name: 'Duplicate', description: null, repositoryUrl: null,
        cloudProvider: 'aws', environment: 'production', aiEnabled: false, tags: [] }, OWNER_ID)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── getProjects ───────────────────────────────────────────────────────────────

describe('ProjectService.getProjects', () => {
  const buildQueryDto = (overrides = {}) => ({
    page: 1,
    limit: 20,
    sortString: '-createdAt',
    search: null,
    status: null,
    cloudProvider: null,
    environment: null,
    owner: null,
    createdAfter: null,
    createdBefore: null,
    ...overrides,
  });

  it('admin receives all projects without scope filter', async () => {
    const projectRepo = createMockProjectRepo();
    const mockResult = { data: [buildMockProject()], pagination: { total: 1, page: 1 } };
    projectRepo.paginate.mockResolvedValue(mockResult);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.getProjects(buildQueryDto(), OWNER_ID, ADMIN_ROLE);

    expect(projectRepo.paginate).toHaveBeenCalled();
    expect(result.projects).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });

  it('non-admin call includes owner scope filter', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.paginate.mockResolvedValue({ data: [], pagination: { total: 0, page: 1 } });

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await service.getProjects(buildQueryDto(), OWNER_ID, OPERATOR_ROLE);

    const callArg = projectRepo.paginate.mock.calls[0][0];
    expect(callArg.$or).toBeDefined();
  });

  it('uses search() when search term is provided', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.search.mockResolvedValue({ data: [], pagination: { total: 0, page: 1 } });

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await service.getProjects(buildQueryDto({ search: 'DevWatch' }), OWNER_ID, ADMIN_ROLE);

    expect(projectRepo.search).toHaveBeenCalledWith(
      'DevWatch',
      expect.any(Object),
      expect.any(Object)
    );
  });
});

// ── getProjectById ────────────────────────────────────────────────────────────

describe('ProjectService.getProjectById', () => {
  it('returns a project when user is the owner', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.getProjectById(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.project).toBeDefined();
    expect(result.project.id).toBe(PROJECT_ID);
  });

  it('returns a project when user is an admin', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.getProjectById(PROJECT_ID, OTHER_ID, ADMIN_ROLE);

    expect(result.project).toBeDefined();
  });

  it('throws 404 when project does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.getProjectById(PROJECT_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when non-admin user is not owner or member', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(buildMockProject({ owner: OWNER_ID, teamMembers: [] }));

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.getProjectById(PROJECT_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns project when user is a team member', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [OTHER_ID] })
    );

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.getProjectById(PROJECT_ID, OTHER_ID, VIEWER_ROLE);
    expect(result.project).toBeDefined();
  });
});

// ── updateProject ─────────────────────────────────────────────────────────────

describe('ProjectService.updateProject', () => {
  const buildUpdateDto = (overrides = {}) => ({
    toUpdatePayload: () => ({ name: 'Updated Name', ...overrides }),
  });

  it('updates and returns the project when user is owner', async () => {
    const projectRepo = createMockProjectRepo();
    const mockProject = buildMockProject();
    const updatedProject = buildMockProject({ name: 'Updated Name' });

    projectRepo.findById.mockResolvedValue(mockProject);
    projectRepo.existsByNameAndOwner.mockResolvedValue(false);
    projectRepo.update.mockResolvedValue(updatedProject);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.updateProject(PROJECT_ID, buildUpdateDto(), OWNER_ID, OPERATOR_ROLE);

    expect(result.project).toBeDefined();
    expect(projectRepo.update).toHaveBeenCalled();
  });

  it('throws 404 when project does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.updateProject(PROJECT_ID, buildUpdateDto(), OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when non-owner non-admin tries to update', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(buildMockProject({ owner: OWNER_ID }));

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.updateProject(PROJECT_ID, buildUpdateDto(), OTHER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 409 when new name duplicates another project', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(buildMockProject({ name: 'Old Name' }));
    projectRepo.existsByNameAndOwner.mockResolvedValue(true);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.updateProject(PROJECT_ID, buildUpdateDto(), OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────

describe('ProjectService.deleteProject', () => {
  it('soft-deletes the project when user is owner', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(buildMockProject());
    projectRepo.softDelete.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await service.deleteProject(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(projectRepo.softDelete).toHaveBeenCalledWith(PROJECT_ID, OWNER_ID);
  });

  it('throws 404 when project does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.deleteProject(PROJECT_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when non-owner non-admin tries to delete', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findById.mockResolvedValue(buildMockProject({ owner: OWNER_ID }));

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.deleteProject(PROJECT_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── restoreProject ────────────────────────────────────────────────────────────

describe('ProjectService.restoreProject', () => {
  it('restores a soft-deleted project when user is owner', async () => {
    const projectRepo = createMockProjectRepo();
    const deletedProject = buildMockProject({ isDeleted: true, owner: OWNER_ID });
    const restoredProject = buildMockProject({ isDeleted: false, owner: OWNER_ID });

    projectRepo.findByIdIncludeDeleted.mockResolvedValue(deletedProject);
    projectRepo.restore.mockResolvedValue(restoredProject);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    const result = await service.restoreProject(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.project).toBeDefined();
    expect(projectRepo.restore).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('throws 404 when project does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findByIdIncludeDeleted.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.restoreProject(PROJECT_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when project is not soft-deleted', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findByIdIncludeDeleted.mockResolvedValue(buildMockProject({ isDeleted: false }));

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.restoreProject(PROJECT_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when non-owner non-admin tries to restore', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findByIdIncludeDeleted.mockResolvedValue(
      buildMockProject({ isDeleted: true, owner: OWNER_ID })
    );

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.restoreProject(PROJECT_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── assignMember ──────────────────────────────────────────────────────────────

describe('ProjectService.assignMember', () => {
  it('adds a new member to the project', async () => {
    const projectRepo = createMockProjectRepo();
    const userRepo = createMockUserRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );
    userRepo.findSafeById.mockResolvedValue(buildMockUser({ _id: MEMBER_ID }));
    projectRepo.addTeamMember.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [MEMBER_ID] })
    );

    const service = new ProjectService(projectRepo, userRepo);
    const result = await service.assignMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.project).toBeDefined();
    expect(projectRepo.addTeamMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
  });

  it('throws 404 when project does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.assignMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when non-owner non-admin tries to assign member', async () => {
    const projectRepo = createMockProjectRepo();
    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.assignMember(PROJECT_ID, MEMBER_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when the target user does not exist', async () => {
    const projectRepo = createMockProjectRepo();
    const userRepo = createMockUserRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );
    userRepo.findSafeById.mockResolvedValue(null);

    const service = new ProjectService(projectRepo, userRepo);
    await expect(
      service.assignMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when user is already a team member', async () => {
    const projectRepo = createMockProjectRepo();
    const userRepo = createMockUserRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [MEMBER_ID] })
    );
    userRepo.findSafeById.mockResolvedValue(buildMockUser({ _id: MEMBER_ID }));

    const service = new ProjectService(projectRepo, userRepo);
    await expect(
      service.assignMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── removeMember ──────────────────────────────────────────────────────────────

describe('ProjectService.removeMember', () => {
  it('removes a team member from the project', async () => {
    const projectRepo = createMockProjectRepo();
    const userRepo = createMockUserRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [MEMBER_ID] })
    );
    projectRepo.removeTeamMember.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new ProjectService(projectRepo, userRepo);
    const result = await service.removeMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.project).toBeDefined();
    expect(projectRepo.removeTeamMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
  });

  it('throws 404 when the user is not a member of the project', async () => {
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.removeMember(PROJECT_ID, MEMBER_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when trying to remove the project owner', async () => {
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [OWNER_ID] })
    );

    const service = new ProjectService(projectRepo, createMockUserRepo());
    await expect(
      service.removeMember(PROJECT_ID, OWNER_ID, OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
