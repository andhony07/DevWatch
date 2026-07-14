/* eslint-disable no-undef */
/**
 * @fileoverview Unit tests for monitoring validator schemas.
 *
 * All schemas expose { validate(data) } → { isValid, errors }.
 * Tests run without MongoDB — pure logic validation only.
 *
 * Schemas tested:
 *   createMonitoringSchema
 *   monitoringQuerySchema
 *   analyticsQuerySchema
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

const {
  createMonitoringSchema,
  monitoringQuerySchema,
  analyticsQuerySchema,
} = await import('../../src/validators/monitoring.validator.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const expectValid = (result) => expect(result.isValid).toBe(true);
const expectInvalid = (result) => expect(result.isValid).toBe(false);
const expectError = (result, field) =>
  expect(result.errors.some((e) => e.field === field)).toBe(true);

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';

// ── createMonitoringSchema ────────────────────────────────────────────────────

describe('createMonitoringSchema', () => {
  it('passes with required projectId only (all metrics optional)', () => {
    const result = createMonitoringSchema.validate({ projectId: VALID_PROJECT_ID });
    expectValid(result);
  });

  it('passes with all valid metric fields', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      cpuUsage: 45.5,
      memoryUsage: 60.0,
      diskUsage: 30.0,
      networkUsage: { inbound: 1024, outbound: 512 },
      responseTime: 120,
      availability: 99.9,
      errorRate: 0.1,
      collectedAt: new Date().toISOString(),
    });
    expectValid(result);
  });

  it('fails when projectId is missing', () => {
    const result = createMonitoringSchema.validate({ cpuUsage: 50 });
    expectInvalid(result);
    expectError(result, 'projectId');
  });

  it('fails when projectId is not a valid ObjectId', () => {
    const result = createMonitoringSchema.validate({ projectId: 'not-an-id' });
    expectInvalid(result);
    expectError(result, 'projectId');
  });

  it('fails when cpuUsage is negative', () => {
    const result = createMonitoringSchema.validate({ projectId: VALID_PROJECT_ID, cpuUsage: -1 });
    expectInvalid(result);
    expectError(result, 'cpuUsage');
  });

  it('fails when cpuUsage exceeds 100', () => {
    const result = createMonitoringSchema.validate({ projectId: VALID_PROJECT_ID, cpuUsage: 101 });
    expectInvalid(result);
    expectError(result, 'cpuUsage');
  });

  it('fails when memoryUsage is not a number', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      memoryUsage: 'high',
    });
    expectInvalid(result);
    expectError(result, 'memoryUsage');
  });

  it('passes when memoryUsage is 0 (boundary)', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      memoryUsage: 0,
    });
    expectValid(result);
  });

  it('passes when memoryUsage is 100 (boundary)', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      memoryUsage: 100,
    });
    expectValid(result);
  });

  it('fails when responseTime is negative', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      responseTime: -5,
    });
    expectInvalid(result);
    expectError(result, 'responseTime');
  });

  it('passes when responseTime is 0 (instant response edge case)', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      responseTime: 0,
    });
    expectValid(result);
  });

  it('fails when networkUsage is not an object', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      networkUsage: 'high-traffic',
    });
    expectInvalid(result);
    expectError(result, 'networkUsage');
  });

  it('fails when networkUsage.inbound is negative', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      networkUsage: { inbound: -100, outbound: 512 },
    });
    expectInvalid(result);
    expectError(result, 'networkUsage.inbound');
  });

  it('passes when networkUsage has null fields (partial)', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      networkUsage: { inbound: null, outbound: null },
    });
    expectValid(result);
  });

  it('fails when collectedAt is not a valid date', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      collectedAt: 'not-a-date',
    });
    expectInvalid(result);
    expectError(result, 'collectedAt');
  });

  it('passes with a valid ISO 8601 collectedAt', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      collectedAt: '2024-06-15T12:00:00.000Z',
    });
    expectValid(result);
  });

  it('fails when availability exceeds 100', () => {
    const result = createMonitoringSchema.validate({
      projectId: VALID_PROJECT_ID,
      availability: 101,
    });
    expectInvalid(result);
    expectError(result, 'availability');
  });
});

// ── monitoringQuerySchema ─────────────────────────────────────────────────────

describe('monitoringQuerySchema', () => {
  it('passes with empty query (all optional)', () => {
    const result = monitoringQuerySchema.validate({});
    expectValid(result);
  });

  it('passes with all valid params', () => {
    const result = monitoringQuerySchema.validate({
      projectId: VALID_PROJECT_ID,
      page: '1',
      limit: '20',
      sortBy: 'cpuUsage',
      sortOrder: 'desc',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T23:59:59.999Z',
    });
    expectValid(result);
  });

  it('fails when projectId is not a valid ObjectId', () => {
    const result = monitoringQuerySchema.validate({ projectId: 'bad-id' });
    expectInvalid(result);
    expectError(result, 'projectId');
  });

  it('fails when page is 0', () => {
    const result = monitoringQuerySchema.validate({ page: '0' });
    expectInvalid(result);
    expectError(result, 'page');
  });

  it('fails when limit exceeds 100', () => {
    const result = monitoringQuerySchema.validate({ limit: '101' });
    expectInvalid(result);
    expectError(result, 'limit');
  });

  it('fails when sortBy is not a valid field', () => {
    const result = monitoringQuerySchema.validate({ sortBy: 'password' });
    expectInvalid(result);
    expectError(result, 'sortBy');
  });

  it('passes for all valid sortBy fields', () => {
    for (const sortBy of ['timestamp', 'cpuUsage', 'memoryUsage', 'responseTime', 'collectedAt']) {
      const result = monitoringQuerySchema.validate({ sortBy });
      expectValid(result);
    }
  });

  it('fails when sortOrder is invalid', () => {
    const result = monitoringQuerySchema.validate({ sortOrder: 'random' });
    expectInvalid(result);
    expectError(result, 'sortOrder');
  });

  it('fails when startDate is invalid', () => {
    const result = monitoringQuerySchema.validate({ startDate: 'not-a-date' });
    expectInvalid(result);
    expectError(result, 'startDate');
  });

  it('fails when endDate is invalid', () => {
    const result = monitoringQuerySchema.validate({ endDate: 'not-a-date' });
    expectInvalid(result);
    expectError(result, 'endDate');
  });

  it('fails when startDate is after endDate', () => {
    const result = monitoringQuerySchema.validate({
      startDate: '2024-12-31T00:00:00.000Z',
      endDate: '2024-01-01T00:00:00.000Z',
    });
    expectInvalid(result);
    expectError(result, 'dateRange');
  });

  it('passes when startDate equals endDate', () => {
    const date = '2024-06-15T00:00:00.000Z';
    const result = monitoringQuerySchema.validate({ startDate: date, endDate: date });
    expectValid(result);
  });
});

// ── analyticsQuerySchema ──────────────────────────────────────────────────────

describe('analyticsQuerySchema', () => {
  it('passes with required projectId', () => {
    const result = analyticsQuerySchema.validate({ projectId: VALID_PROJECT_ID });
    expectValid(result);
  });

  it('passes with all valid params', () => {
    const result = analyticsQuerySchema.validate({
      projectId: VALID_PROJECT_ID,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T23:59:59.999Z',
      granularity: 'day',
    });
    expectValid(result);
  });

  it('fails when projectId is missing', () => {
    const result = analyticsQuerySchema.validate({});
    expectInvalid(result);
    expectError(result, 'projectId');
  });

  it('fails when projectId is invalid ObjectId', () => {
    const result = analyticsQuerySchema.validate({ projectId: 'bad-id' });
    expectInvalid(result);
    expectError(result, 'projectId');
  });

  it('fails when granularity is not hour or day', () => {
    const result = analyticsQuerySchema.validate({
      projectId: VALID_PROJECT_ID,
      granularity: 'week',
    });
    expectInvalid(result);
    expectError(result, 'granularity');
  });

  it('passes for both valid granularity values', () => {
    for (const granularity of ['hour', 'day']) {
      const result = analyticsQuerySchema.validate({ projectId: VALID_PROJECT_ID, granularity });
      expectValid(result);
    }
  });

  it('fails when date range is inverted', () => {
    const result = analyticsQuerySchema.validate({
      projectId: VALID_PROJECT_ID,
      startDate: '2024-12-01T00:00:00.000Z',
      endDate: '2024-01-01T00:00:00.000Z',
    });
    expectInvalid(result);
    expectError(result, 'dateRange');
  });
});
