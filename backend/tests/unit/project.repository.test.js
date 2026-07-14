/* eslint-disable no-undef */
/**
 * @fileoverview Unit tests for ProjectRepository extended methods.
 *
 * The Mongoose model is replaced with a manual mock so no MongoDB connection is needed.
 * We test the repository methods that are new in Phase 5:
 *   - search()
 *   - findAllWithFilters()
 *   - existsByNameAndOwner()
 *   - findByIdIncludeDeleted()
 *   - addTeamMember()
 *   - removeTeamMember()
 *
 * Existing base methods (create, update, softDelete, etc.) are covered by
 * integration tests in the `tests/integration/` directory.
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

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Minimal Model Mock ────────────────────────────────────────────────────────

/**
 * Creates a chainable Mongoose query mock.
 *
 * @param {*} resolveValue - The value the exec/query resolves with
 * @returns {object} Chainable mock
 */
const createQueryMock = (resolveValue) => {
  const mock = {
    setOptions: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
    // Make the mock itself thenable so `await query` works
    then: (resolve, reject) =>
      Promise.resolve(resolveValue).then(resolve, reject),
  };
  return mock;
};

/**
 * Builds a minimal mock of the Mongoose Project model.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
const buildMockModel = (overrides = {}) => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn().mockResolvedValue(0),
  exists: jest.fn(),
  ...overrides,
});

const PROJECT_ID = 'dddd00000000000000000004';
const OWNER_ID = 'aaaa00000000000000000001';
const MEMBER_ID = 'cccc00000000000000000003';

const buildDoc = (overrides = {}) => ({
  _id: PROJECT_ID,
  id: PROJECT_ID,
  name: 'DevWatch API',
  owner: OWNER_ID,
  teamMembers: [],
  isDeleted: false,
  toJSON: jest.fn().mockReturnValue({ id: PROJECT_ID }),
  ...overrides,
});

// ── Import after mocks ────────────────────────────────────────────────────────
const { ProjectRepository } = await import('../../src/repositories/ProjectRepository.js');

// ── Helper: build a repo instance with a custom model mock ────────────────────
const buildRepo = (modelOverrides = {}) => {
  const repo = new ProjectRepository();
  repo.model = buildMockModel(modelOverrides);
  return repo;
};

// ── search() ─────────────────────────────────────────────────────────────────

describe('ProjectRepository.search', () => {
  it('calls paginate with a $or regex filter', async () => {
    const repo = buildRepo();
    // Mock internal paginate call's components
    repo.model.countDocuments.mockResolvedValue(1);
    const mockDoc = buildDoc();
    repo.model.find.mockReturnValue(createQueryMock([mockDoc]));

    const result = await repo.search('DevWatch', {}, { page: 1, limit: 20 });

    // Result should have the paginated structure
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    // The find was called — regex filter applied
    expect(repo.model.find).toHaveBeenCalled();
    const filterArg = repo.model.find.mock.calls[0][0];
    expect(filterArg.$or).toBeDefined();
    expect(Array.isArray(filterArg.$or)).toBe(true);
    expect(filterArg.$or).toHaveLength(4); // name, description, repositoryUrl, tags
  });

  it('escapes special regex characters in the search term', async () => {
    const repo = buildRepo();
    repo.model.countDocuments.mockResolvedValue(0);
    repo.model.find.mockReturnValue(createQueryMock([]));

    await repo.search('test.project+api', {}, {});

    const filterArg = repo.model.find.mock.calls[0][0];
    const nameRegex = filterArg.$or[0].name;
    // The dot and plus should be escaped
    expect(nameRegex.source).toContain('\\.');
    expect(nameRegex.source).toContain('\\+');
  });
});

// ── findAllWithFilters() ──────────────────────────────────────────────────────

describe('ProjectRepository.findAllWithFilters', () => {
  it('builds correct filter when all params are provided', async () => {
    const repo = buildRepo();
    repo.model.countDocuments.mockResolvedValue(0);
    repo.model.find.mockReturnValue(createQueryMock([]));

    const after = new Date('2024-01-01');
    const before = new Date('2024-12-31');

    await repo.findAllWithFilters({
      status: 'active',
      cloudProvider: 'aws',
      environment: 'production',
      owner: OWNER_ID,
      createdAfter: after,
      createdBefore: before,
    });

    const filterArg = repo.model.find.mock.calls[0][0];
    expect(filterArg.status).toBe('active');
    expect(filterArg.cloudProvider).toBe('aws');
    expect(filterArg.environment).toBe('production');
    expect(filterArg.owner).toBe(OWNER_ID);
    expect(filterArg.createdAt.$gte).toEqual(after);
    expect(filterArg.createdAt.$lte).toEqual(before);
  });

  it('builds empty filter when no params are provided', async () => {
    const repo = buildRepo();
    repo.model.countDocuments.mockResolvedValue(0);
    repo.model.find.mockReturnValue(createQueryMock([]));

    await repo.findAllWithFilters({});

    const filterArg = repo.model.find.mock.calls[0][0];
    expect(Object.keys(filterArg)).toHaveLength(0);
  });
});

// ── existsByNameAndOwner() ────────────────────────────────────────────────────

describe('ProjectRepository.existsByNameAndOwner', () => {
  it('returns true when a matching project exists', async () => {
    const repo = buildRepo({ exists: jest.fn().mockResolvedValue({ _id: PROJECT_ID }) });

    const result = await repo.existsByNameAndOwner('DevWatch API', OWNER_ID);

    expect(result).toBe(true);
    expect(repo.model.exists).toHaveBeenCalledWith(
      expect.objectContaining({ owner: OWNER_ID })
    );
  });

  it('returns false when no matching project exists', async () => {
    const repo = buildRepo({ exists: jest.fn().mockResolvedValue(null) });

    const result = await repo.existsByNameAndOwner('Nonexistent', OWNER_ID);

    expect(result).toBe(false);
  });

  it('excludes the given ID from the check (for update operations)', async () => {
    const repo = buildRepo({ exists: jest.fn().mockResolvedValue(null) });

    await repo.existsByNameAndOwner('DevWatch API', OWNER_ID, PROJECT_ID);

    const filterArg = repo.model.exists.mock.calls[0][0];
    expect(filterArg._id).toEqual({ $ne: PROJECT_ID });
  });

  it('creates a case-insensitive regex for name comparison', async () => {
    const repo = buildRepo({ exists: jest.fn().mockResolvedValue(null) });

    await repo.existsByNameAndOwner('devwatch api', OWNER_ID);

    const filterArg = repo.model.exists.mock.calls[0][0];
    expect(filterArg.name).toBeInstanceOf(RegExp);
    expect(filterArg.name.flags).toContain('i');
  });
});

// ── findByIdIncludeDeleted() ──────────────────────────────────────────────────

describe('ProjectRepository.findByIdIncludeDeleted', () => {
  it('calls findById with includeDeleted option', async () => {
    const doc = buildDoc({ isDeleted: true });
    const queryMock = createQueryMock(doc);
    const repo = buildRepo({ findById: jest.fn().mockReturnValue(queryMock) });

    const result = await repo.findByIdIncludeDeleted(PROJECT_ID);

    expect(repo.model.findById).toHaveBeenCalledWith(PROJECT_ID);
    expect(queryMock.setOptions).toHaveBeenCalledWith({ includeDeleted: true });
    expect(result).toEqual(doc);
  });

  it('returns null when document does not exist', async () => {
    const queryMock = createQueryMock(null);
    const repo = buildRepo({ findById: jest.fn().mockReturnValue(queryMock) });

    const result = await repo.findByIdIncludeDeleted('000000000000000000000000');
    expect(result).toBeNull();
  });
});

// ── addTeamMember() ───────────────────────────────────────────────────────────

describe('ProjectRepository.addTeamMember', () => {
  it('calls findByIdAndUpdate with $addToSet operator', async () => {
    const updatedDoc = buildDoc({ teamMembers: [MEMBER_ID] });
    const repo = buildRepo({
      findByIdAndUpdate: jest.fn().mockResolvedValue(updatedDoc),
    });

    const result = await repo.addTeamMember(PROJECT_ID, MEMBER_ID);

    expect(repo.model.findByIdAndUpdate).toHaveBeenCalledWith(
      PROJECT_ID,
      { $addToSet: { teamMembers: MEMBER_ID } },
      { new: true }
    );
    expect(result).toEqual(updatedDoc);
  });
});

// ── removeTeamMember() ────────────────────────────────────────────────────────

describe('ProjectRepository.removeTeamMember', () => {
  it('calls findByIdAndUpdate with $pull operator', async () => {
    const updatedDoc = buildDoc({ teamMembers: [] });
    const repo = buildRepo({
      findByIdAndUpdate: jest.fn().mockResolvedValue(updatedDoc),
    });

    const result = await repo.removeTeamMember(PROJECT_ID, MEMBER_ID);

    expect(repo.model.findByIdAndUpdate).toHaveBeenCalledWith(
      PROJECT_ID,
      { $pull: { teamMembers: MEMBER_ID } },
      { new: true }
    );
    expect(result).toEqual(updatedDoc);
  });
});
