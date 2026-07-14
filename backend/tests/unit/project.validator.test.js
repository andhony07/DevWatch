/* eslint-disable no-undef */
/**
 * @fileoverview Unit tests for project validator schemas.
 *
 * All schemas expose { validate(data) } → { isValid, errors }.
 * Tests run without MongoDB — pure logic validation.
 *
 * Schemas tested:
 *   createProjectSchema
 *   updateProjectSchema
 *   assignMemberSchema
 *   projectQuerySchema
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
  createProjectSchema,
  updateProjectSchema,
  assignMemberSchema,
  projectQuerySchema,
} = await import('../../src/validators/project.validator.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const expectValid = (result) => expect(result.isValid).toBe(true);
const expectInvalid = (result) => expect(result.isValid).toBe(false);
const expectError = (result, field) =>
  expect(result.errors.some((e) => e.field === field)).toBe(true);

// ── createProjectSchema ───────────────────────────────────────────────────────

describe('createProjectSchema', () => {
  it('passes with required name only', () => {
    const result = createProjectSchema.validate({ name: 'DevWatch API' });
    expectValid(result);
  });

  it('passes with all valid optional fields', () => {
    const result = createProjectSchema.validate({
      name: 'Full Project',
      description: 'A description',
      repositoryUrl: 'https://github.com/org/repo',
      cloudProvider: 'aws',
      environment: 'production',
      aiEnabled: true,
      tags: ['tag1', 'tag2'],
    });
    expectValid(result);
  });

  it('fails when name is missing', () => {
    const result = createProjectSchema.validate({ description: 'No name' });
    expectInvalid(result);
    expectError(result, 'name');
  });

  it('fails when name is too short (< 2 chars)', () => {
    const result = createProjectSchema.validate({ name: 'A' });
    expectInvalid(result);
    expectError(result, 'name');
  });

  it('fails when name exceeds 100 characters', () => {
    const result = createProjectSchema.validate({ name: 'A'.repeat(101) });
    expectInvalid(result);
    expectError(result, 'name');
  });

  it('fails when repositoryUrl is not a valid URL', () => {
    const result = createProjectSchema.validate({ name: 'Test', repositoryUrl: 'not-a-url' });
    expectInvalid(result);
    expectError(result, 'repositoryUrl');
  });

  it('passes when repositoryUrl is a valid https URL', () => {
    const result = createProjectSchema.validate({
      name: 'Test',
      repositoryUrl: 'https://github.com/user/repo',
    });
    expectValid(result);
  });

  it('fails when cloudProvider is not a valid enum value', () => {
    const result = createProjectSchema.validate({ name: 'Test', cloudProvider: 'kubernetes' });
    expectInvalid(result);
    expectError(result, 'cloudProvider');
  });

  it('fails when environment is not a valid enum value', () => {
    const result = createProjectSchema.validate({ name: 'Test', environment: 'omega' });
    expectInvalid(result);
    expectError(result, 'environment');
  });

  it('fails when aiEnabled is not a boolean', () => {
    const result = createProjectSchema.validate({ name: 'Test', aiEnabled: 'yes' });
    expectInvalid(result);
    expectError(result, 'aiEnabled');
  });

  it('fails when tags exceeds 20 items', () => {
    const result = createProjectSchema.validate({ name: 'Test', tags: Array(21).fill('tag') });
    expectInvalid(result);
    expectError(result, 'tags');
  });

  it('fails when tags is not an array', () => {
    const result = createProjectSchema.validate({ name: 'Test', tags: 'single-string-tag' });
    expectInvalid(result);
    expectError(result, 'tags');
  });

  it('fails when a tag exceeds 50 characters', () => {
    const result = createProjectSchema.validate({ name: 'Test', tags: ['a'.repeat(51)] });
    expectInvalid(result);
    expectError(result, 'tags');
  });
});

// ── updateProjectSchema ───────────────────────────────────────────────────────

describe('updateProjectSchema', () => {
  it('passes with a single valid field', () => {
    const result = updateProjectSchema.validate({ name: 'New Name' });
    expectValid(result);
  });

  it('passes with multiple valid fields', () => {
    const result = updateProjectSchema.validate({
      name: 'Updated',
      status: 'inactive',
      aiEnabled: true,
      tags: ['devops'],
    });
    expectValid(result);
  });

  it('fails when no fields are provided', () => {
    const result = updateProjectSchema.validate({});
    expectInvalid(result);
    expectError(result, 'body');
  });

  it('fails when name is empty string', () => {
    const result = updateProjectSchema.validate({ name: '  ' });
    expectInvalid(result);
    expectError(result, 'name');
  });

  it('fails when status is not a valid enum value', () => {
    const result = updateProjectSchema.validate({ status: 'running' });
    expectInvalid(result);
    expectError(result, 'status');
  });

  it('passes with valid status values', () => {
    for (const status of ['active', 'inactive', 'archived']) {
      const result = updateProjectSchema.validate({ status });
      expectValid(result);
    }
  });

  it('fails when repositoryUrl is invalid', () => {
    const result = updateProjectSchema.validate({ repositoryUrl: 'ftp://not-valid' });
    expectInvalid(result);
    expectError(result, 'repositoryUrl');
  });

  it('passes when repositoryUrl is null (clearing the value)', () => {
    const result = updateProjectSchema.validate({ repositoryUrl: null });
    expectValid(result);
  });
});

// ── assignMemberSchema ────────────────────────────────────────────────────────

describe('assignMemberSchema', () => {
  it('passes with a valid 24-character ObjectId', () => {
    const result = assignMemberSchema.validate({ userId: 'a'.repeat(24) });
    expectValid(result);
  });

  it('fails when userId is missing', () => {
    const result = assignMemberSchema.validate({});
    expectInvalid(result);
    expectError(result, 'userId');
  });

  it('fails when userId is not a valid ObjectId (too short)', () => {
    const result = assignMemberSchema.validate({ userId: '12345' });
    expectInvalid(result);
    expectError(result, 'userId');
  });

  it('fails when userId is not a valid ObjectId (non-hex chars)', () => {
    const result = assignMemberSchema.validate({ userId: 'zzzzzzzzzzzzzzzzzzzzzzzz' });
    expectInvalid(result);
    expectError(result, 'userId');
  });

  it('passes with a real-format ObjectId', () => {
    const result = assignMemberSchema.validate({ userId: '507f1f77bcf86cd799439011' });
    expectValid(result);
  });
});

// ── projectQuerySchema ────────────────────────────────────────────────────────

describe('projectQuerySchema', () => {
  it('passes with empty query (all params optional)', () => {
    const result = projectQuerySchema.validate({});
    expectValid(result);
  });

  it('passes with all valid optional params', () => {
    const result = projectQuerySchema.validate({
      page: '1',
      limit: '10',
      sortBy: 'name',
      sortOrder: 'asc',
      status: 'active',
      cloudProvider: 'aws',
      environment: 'production',
      owner: '507f1f77bcf86cd799439011',
      createdAfter: '2024-01-01T00:00:00.000Z',
      createdBefore: '2024-12-31T23:59:59.999Z',
    });
    expectValid(result);
  });

  it('fails when page is not a positive integer', () => {
    const result = projectQuerySchema.validate({ page: '0' });
    expectInvalid(result);
    expectError(result, 'page');
  });

  it('fails when limit is out of range', () => {
    const result = projectQuerySchema.validate({ limit: '999' });
    expectInvalid(result);
    expectError(result, 'limit');
  });

  it('fails when sortBy is not a valid field', () => {
    const result = projectQuerySchema.validate({ sortBy: 'password' });
    expectInvalid(result);
    expectError(result, 'sortBy');
  });

  it('fails when sortOrder is not asc or desc', () => {
    const result = projectQuerySchema.validate({ sortOrder: 'random' });
    expectInvalid(result);
    expectError(result, 'sortOrder');
  });

  it('fails when status filter is invalid', () => {
    const result = projectQuerySchema.validate({ status: 'running' });
    expectInvalid(result);
    expectError(result, 'status');
  });

  it('fails when cloudProvider filter is invalid', () => {
    const result = projectQuerySchema.validate({ cloudProvider: 'linode' });
    expectInvalid(result);
    expectError(result, 'cloudProvider');
  });

  it('fails when owner is not a valid ObjectId', () => {
    const result = projectQuerySchema.validate({ owner: 'not-an-id' });
    expectInvalid(result);
    expectError(result, 'owner');
  });

  it('fails when createdAfter is not a valid date', () => {
    const result = projectQuerySchema.validate({ createdAfter: 'not-a-date' });
    expectInvalid(result);
    expectError(result, 'createdAfter');
  });

  it('fails when createdBefore is not a valid date', () => {
    const result = projectQuerySchema.validate({ createdBefore: 'not-a-date' });
    expectInvalid(result);
    expectError(result, 'createdBefore');
  });
});
