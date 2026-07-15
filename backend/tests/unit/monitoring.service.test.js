/* eslint-disable no-undef */
 
/**
 * @fileoverview Unit tests for MonitoringService.
 *
 * All external dependencies (MonitoringRepository, ProjectRepository, logger)
 * are mocked so these tests run without a live MongoDB connection.
 *
 * Test scenarios:
 *   recordSnapshot   — success, project not found, forbidden (non-owner)
 *   getLatestMetrics — success, project not found, forbidden, null snapshot
 *   getHistory       — success (admin), success (with projectId), 400 (no projectId, non-admin)
 *   getProjectMetrics — success, project not found, forbidden
 *   getAnalytics     — success, no data, project not found, forbidden
 *   runRetentionCleanup — success
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

jest.unstable_mockModule('../../src/sockets/services/RealtimeMonitoringService.js', () => ({
  realtimeMonitoringService: {
    broadcastMetricUpdate: jest.fn(),
    broadcastAnalytics: jest.fn(),
  },
}));

// ── Dynamic Imports ───────────────────────────────────────────────────────────

const { MonitoringService } = await import('../../src/services/monitoring.service.js');

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_ROLE = 'admin';
const OPERATOR_ROLE = 'operator';
const VIEWER_ROLE = 'viewer';

const OWNER_ID = 'aaaa00000000000000000001';
const OTHER_ID = 'bbbb00000000000000000002';
const PROJECT_ID = 'dddd00000000000000000004';
const SNAPSHOT_ID = 'eeee00000000000000000005';

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildMockProject = (overrides = {}) => {
  const base = {
    _id: PROJECT_ID,
    id: PROJECT_ID,
    name: 'Test Project',
    owner: OWNER_ID,
    teamMembers: [],
    toJSON: jest.fn().mockReturnValue({ id: PROJECT_ID, name: 'Test Project' }),
    ...overrides,
  };
  return base;
};

const buildMockSnapshot = (overrides = {}) => {
  const base = {
    _id: SNAPSHOT_ID,
    id: SNAPSHOT_ID,
    project: PROJECT_ID,
    cpuUsage: 45.5,
    memoryUsage: 60.2,
    diskUsage: 30.0,
    networkUsage: { inbound: 1024, outbound: 512 },
    responseTime: 120,
    availability: 99.9,
    errorRate: 0.1,
    collectedAt: new Date(),
    healthStatus: 'healthy',
    toJSON: jest.fn().mockReturnValue({
      id: SNAPSHOT_ID,
      project: PROJECT_ID,
      cpuUsage: 45.5,
      healthStatus: 'healthy',
    }),
    ...overrides,
  };
  return base;
};

const createMockMonitoringRepo = () => ({
  createSnapshot: jest.fn(),
  findLatestByProject: jest.fn(),
  findHistory: jest.fn(),
  findInTimeRange: jest.fn(),
  calculateKPIs: jest.fn(),
  aggregateByPeriod: jest.fn(),
  globalCleanup: jest.fn(),
});

const createMockProjectRepo = () => ({
  findWithTeam: jest.fn(),
});

/**
 * Builds a CreateMonitoringDTO-like object for tests.
 */
const buildDto = (overrides = {}) => ({
  projectId: PROJECT_ID,
  cpuUsage: 45.5,
  memoryUsage: 60.2,
  diskUsage: 30.0,
  networkUsage: null,
  responseTime: 120,
  availability: 99.9,
  errorRate: 0.1,
  collectedAt: new Date(),
  toDocument: jest.fn().mockReturnValue({
    project: PROJECT_ID,
    cpuUsage: 45.5,
    memoryUsage: 60.2,
    diskUsage: 30.0,
    responseTime: 120,
    availability: 99.9,
    errorRate: 0.1,
    collectedAt: new Date(),
  }),
  ...overrides,
});

/**
 * Builds a MonitoringQueryDTO-like object.
 */
const buildQueryDto = (overrides = {}) => ({
  projectId: PROJECT_ID,
  page: 1,
  limit: 20,
  sortString: '-collectedAt',
  startDate: null,
  endDate: null,
  ...overrides,
});

/**
 * Builds an AnalyticsQueryDTO-like object.
 */
const buildAnalyticsDto = (overrides = {}) => ({
  projectId: PROJECT_ID,
  startDate: null,
  endDate: null,
  granularity: 'hour',
  ...overrides,
});

// ── recordSnapshot ────────────────────────────────────────────────────────────

describe('MonitoringService.recordSnapshot', () => {
  it('records a snapshot when user is owner', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.createSnapshot.mockResolvedValue(buildMockSnapshot());

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.recordSnapshot(buildDto(), OWNER_ID, OPERATOR_ROLE);

    expect(result.snapshot).toBeDefined();
    expect(monitoringRepo.createSnapshot).toHaveBeenCalled();
  });

  it('records a snapshot when user is admin', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.createSnapshot.mockResolvedValue(buildMockSnapshot());

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.recordSnapshot(buildDto(), OTHER_ID, ADMIN_ROLE);

    expect(result.snapshot).toBeDefined();
  });

  it('throws 404 when project does not exist', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(null);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.recordSnapshot(buildDto(), OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when non-owner non-admin tries to record', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject({ owner: OWNER_ID }));

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.recordSnapshot(buildDto(), OTHER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getLatestMetrics ──────────────────────────────────────────────────────────

describe('MonitoringService.getLatestMetrics', () => {
  it('returns the latest snapshot for the project owner', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.findLatestByProject.mockResolvedValue(buildMockSnapshot());

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getLatestMetrics(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.project).toBe(PROJECT_ID);
  });

  it('returns null snapshot when no data exists', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.findLatestByProject.mockResolvedValue(null);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getLatestMetrics(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.snapshot).toBeNull();
  });

  it('throws 403 when non-member non-admin tries to read', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.getLatestMetrics(PROJECT_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns snapshot for a team member', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [OTHER_ID] })
    );
    monitoringRepo.findLatestByProject.mockResolvedValue(buildMockSnapshot());

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getLatestMetrics(PROJECT_ID, OTHER_ID, VIEWER_ROLE);

    expect(result.snapshot).toBeDefined();
  });
});

// ── getHistory ────────────────────────────────────────────────────────────────

describe('MonitoringService.getHistory', () => {
  it('returns paginated history for the project owner', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.findHistory.mockResolvedValue({
      data: [buildMockSnapshot()],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getHistory(buildQueryDto(), OWNER_ID, OPERATOR_ROLE);

    expect(result.snapshots).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });

  it('admin can get history without a projectId', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    monitoringRepo.findHistory.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getHistory(
      buildQueryDto({ projectId: null }),
      OTHER_ID,
      ADMIN_ROLE
    );

    expect(result.snapshots).toHaveLength(0);
    // findWithTeam should NOT have been called since no projectId
    expect(projectRepo.findWithTeam).not.toHaveBeenCalled();
  });

  it('throws 400 when non-admin requests history without projectId', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.getHistory(buildQueryDto({ projectId: null }), OWNER_ID, OPERATOR_ROLE)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── getProjectMetrics ─────────────────────────────────────────────────────────

describe('MonitoringService.getProjectMetrics', () => {
  it('returns latest + kpis for the project owner', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.findLatestByProject.mockResolvedValue(buildMockSnapshot());
    monitoringRepo.calculateKPIs.mockResolvedValue({
      avgCpu: 45.5,
      peakCpu: 80.0,
      avgMemory: 60.2,
      peakMemory: 85.0,
      avgDisk: 30.0,
      avgResponseTime: 120,
      maxResponseTime: 300,
      minResponseTime: 50,
      avgAvailability: 99.9,
      avgErrorRate: 0.1,
      sampleCount: 100,
      responseTimes: [50, 100, 120, 150, 300],
    });
    monitoringRepo.findInTimeRange.mockResolvedValue([buildMockSnapshot()]);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getProjectMetrics(PROJECT_ID, OWNER_ID, OPERATOR_ROLE);

    expect(result.latest).toBeDefined();
    expect(result.kpis).toBeDefined();
    expect(result.kpis.healthScore).not.toBeNull();
    expect(result.project).toBeDefined();
  });

  it('throws 403 for non-member non-admin', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.getProjectMetrics(PROJECT_ID, OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getAnalytics ──────────────────────────────────────────────────────────────

describe('MonitoringService.getAnalytics', () => {
  it('returns analytics when data exists', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.calculateKPIs.mockResolvedValue({
      avgCpu: 45.5,
      peakCpu: 80.0,
      avgMemory: 60.2,
      peakMemory: 85.0,
      avgDisk: 30.0,
      avgNetworkInbound: null,
      avgNetworkOutbound: null,
      avgResponseTime: 120,
      maxResponseTime: 300,
      minResponseTime: 50,
      avgAvailability: 99.9,
      avgErrorRate: 0.1,
      sampleCount: 100,
      responseTimes: [50, 100, 120, 150, 300],
    });
    monitoringRepo.aggregateByPeriod.mockResolvedValue([]);
    monitoringRepo.findInTimeRange.mockResolvedValue([]);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getAnalytics(
      buildAnalyticsDto(),
      OWNER_ID,
      OPERATOR_ROLE
    );

    expect(result.analytics).toBeDefined();
    expect(result.analytics.projectId).toBe(PROJECT_ID);
    expect(result.analytics.sampleCount).toBe(100);
  });

  it('returns empty analytics when no data', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(buildMockProject());
    monitoringRepo.calculateKPIs.mockResolvedValue(null);
    monitoringRepo.aggregateByPeriod.mockResolvedValue([]);
    monitoringRepo.findInTimeRange.mockResolvedValue([]);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.getAnalytics(
      buildAnalyticsDto(),
      OWNER_ID,
      OPERATOR_ROLE
    );

    expect(result.analytics.sampleCount).toBe(0);
    expect(result.analytics.timeSeries).toEqual([]);
  });

  it('throws 403 for non-member non-admin', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    projectRepo.findWithTeam.mockResolvedValue(
      buildMockProject({ owner: OWNER_ID, teamMembers: [] })
    );

    const service = new MonitoringService(monitoringRepo, projectRepo);
    await expect(
      service.getAnalytics(buildAnalyticsDto(), OTHER_ID, VIEWER_ROLE)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── runRetentionCleanup ───────────────────────────────────────────────────────

describe('MonitoringService.runRetentionCleanup', () => {
  it('delegates to globalCleanup and returns deleted count + cutoffDate', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    monitoringRepo.globalCleanup.mockResolvedValue(42);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.runRetentionCleanup(90);

    expect(result.deleted).toBe(42);
    expect(result.cutoffDate).toBeInstanceOf(Date);
    expect(monitoringRepo.globalCleanup).toHaveBeenCalledWith(expect.any(Date));
  });

  it('uses 90 days retention by default', async () => {
    const monitoringRepo = createMockMonitoringRepo();
    const projectRepo = createMockProjectRepo();

    monitoringRepo.globalCleanup.mockResolvedValue(0);

    const service = new MonitoringService(monitoringRepo, projectRepo);
    const result = await service.runRetentionCleanup();

    const cutoffDaysAgo = Math.round(
      (Date.now() - result.cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(cutoffDaysAgo).toBeCloseTo(90, 0);
  });
});
