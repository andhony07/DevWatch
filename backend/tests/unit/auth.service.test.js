/**
 * @fileoverview Unit tests for AuthService.
 *
 * All external dependencies (UserRepository, jwt.util, password.util) are mocked
 * so these tests run without a live MongoDB connection.
 *
 * Test scenarios:
 *   register   — success, duplicate email
 *   login      — success, wrong password, inactive account, user not found
 *   refreshToken — success (rotation), invalid JWT, hash mismatch (replay attack)
 *   logout     — success
 *   getMe      — success, user not found
 *   forgotPassword — known email, unknown email
 *   resetPassword  — success, invalid/expired token
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

// Mock jwt.util
const mockSignAccessToken = jest.fn().mockReturnValue('mock.access.token');
const mockSignRefreshToken = jest.fn().mockReturnValue('mock.refresh.token');
const mockVerifyRefreshToken = jest.fn();

jest.unstable_mockModule('../../src/utils/jwt.util.js', () => ({
  signAccessToken: mockSignAccessToken,
  signRefreshToken: mockSignRefreshToken,
  verifyRefreshToken: mockVerifyRefreshToken,
  decodeToken: jest.fn(),
}));

// Mock password.util
const mockHashPassword = jest.fn().mockResolvedValue('$2b$12$hashed_password');
const mockComparePassword = jest.fn();
const mockGenerateSecureToken = jest.fn().mockReturnValue('raw_token_hex_64_chars');
const mockHashToken = jest.fn().mockImplementation((t) => `sha256:${t}`);

jest.unstable_mockModule('../../src/utils/password.util.js', () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
  generateSecureToken: mockGenerateSecureToken,
  hashToken: mockHashToken,
}));

// Mock logger to suppress noise during tests
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Dynamic Imports (after mocks are registered) ──────────────────────────────
const { AuthService } = await import('../../src/services/auth.service.js');
const { ApiError } = await import('../../src/utils/ApiError.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock UserRepository with all required methods as jest.fn().
 */
const createMockUserRepo = () => ({
  emailExists: jest.fn(),
  create: jest.fn(),
  findByEmail: jest.fn(),
  updateLastLogin: jest.fn(),
  storeRefreshToken: jest.fn(),
  findByIdWithRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
  findSafeById: jest.fn(),
  findOne: jest.fn(),
  setPasswordResetToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  updatePassword: jest.fn(),
  clearPasswordResetToken: jest.fn(),
  setEmailVerificationToken: jest.fn(),
  findByEmailVerificationToken: jest.fn(),
  verifyEmail: jest.fn(),
});

const buildMockUser = (overrides = {}) => ({
  _id: 'user_id_123',
  id: 'user_id_123',
  email: 'dev@devwatch.io',
  fullName: 'Dev User',
  role: 'viewer',
  status: 'active',
  password: '$2b$12$hashedPasswordValue',
  refreshToken: null,
  toJSON: jest.fn().mockReturnValue({
    id: 'user_id_123',
    email: 'dev@devwatch.io',
    role: 'viewer',
  }),
  ...overrides,
});

// ── register ──────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  it('creates a user and returns the safe user object', async () => {
    const repo = createMockUserRepo();
    const mockUser = buildMockUser();
    repo.emailExists.mockResolvedValue(false);
    repo.create.mockResolvedValue(mockUser);
    repo.setEmailVerificationToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    const dto = { fullName: 'Dev User', email: 'dev@devwatch.io', password: 'SecurePass1!' };
    const result = await service.register(dto);

    expect(repo.emailExists).toHaveBeenCalledWith('dev@devwatch.io');
    expect(repo.create).toHaveBeenCalled();
    expect(result.user).toBeDefined();
  });

  it('throws 409 Conflict when email is already in use', async () => {
    const repo = createMockUserRepo();
    repo.emailExists.mockResolvedValue(true);

    const service = new AuthService(repo);
    await expect(
      service.register({ fullName: 'A', email: 'dup@devwatch.io', password: 'Pass1!' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  it('returns user, accessToken, and refreshToken on valid credentials', async () => {
    const repo = createMockUserRepo();
    const mockUser = buildMockUser();
    repo.findByEmail.mockResolvedValue(mockUser);
    mockComparePassword.mockResolvedValue(true);
    repo.storeRefreshToken.mockResolvedValue(null);
    repo.updateLastLogin.mockResolvedValue(null);

    const service = new AuthService(repo);
    const result = await service.login({ email: 'dev@devwatch.io', password: 'SecurePass1!' });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(repo.storeRefreshToken).toHaveBeenCalled();
  });

  it('throws 401 when user is not found', async () => {
    const repo = createMockUserRepo();
    repo.findByEmail.mockResolvedValue(null);

    const service = new AuthService(repo);
    await expect(
      service.login({ email: 'nobody@devwatch.io', password: 'pass' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when password does not match', async () => {
    const repo = createMockUserRepo();
    repo.findByEmail.mockResolvedValue(buildMockUser());
    mockComparePassword.mockResolvedValue(false);

    const service = new AuthService(repo);
    await expect(
      service.login({ email: 'dev@devwatch.io', password: 'WrongPass1!' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 when account is inactive', async () => {
    const repo = createMockUserRepo();
    repo.findByEmail.mockResolvedValue(buildMockUser({ status: 'inactive' }));
    mockComparePassword.mockResolvedValue(true);

    const service = new AuthService(repo);
    await expect(
      service.login({ email: 'dev@devwatch.io', password: 'SecurePass1!' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── refreshToken ──────────────────────────────────────────────────────────────

describe('AuthService.refreshToken', () => {
  it('rotates tokens when the refresh token is valid and hash matches', async () => {
    const repo = createMockUserRepo();
    const hashedToken = mockHashToken('mock.refresh.token');
    const mockUser = buildMockUser({ refreshToken: hashedToken });

    mockVerifyRefreshToken.mockReturnValue({ sub: 'user_id_123' });
    repo.findByIdWithRefreshToken.mockResolvedValue(mockUser);
    repo.storeRefreshToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    const result = await service.refreshToken('mock.refresh.token');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(repo.storeRefreshToken).toHaveBeenCalled();
  });

  it('throws 401 when JWT verification fails', async () => {
    mockVerifyRefreshToken.mockImplementation(() => { throw new Error('expired'); });

    const service = new AuthService(createMockUserRepo());
    await expect(service.refreshToken('bad.token.here')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('invalidates stored token on hash mismatch (replay attack)', async () => {
    const repo = createMockUserRepo();
    mockVerifyRefreshToken.mockReturnValue({ sub: 'user_id_123' });
    repo.findByIdWithRefreshToken.mockResolvedValue(
      buildMockUser({ refreshToken: 'sha256:different_hash' })
    );
    repo.clearRefreshToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    await expect(service.refreshToken('mock.refresh.token')).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(repo.clearRefreshToken).toHaveBeenCalled();
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  it('calls clearRefreshToken with the user ID', async () => {
    const repo = createMockUserRepo();
    repo.clearRefreshToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    await service.logout('user_id_123');

    expect(repo.clearRefreshToken).toHaveBeenCalledWith('user_id_123');
  });
});

// ── getMe ─────────────────────────────────────────────────────────────────────

describe('AuthService.getMe', () => {
  it('returns the user profile when found', async () => {
    const repo = createMockUserRepo();
    repo.findSafeById.mockResolvedValue(buildMockUser());

    const service = new AuthService(repo);
    const result = await service.getMe('user_id_123');

    expect(result).toHaveProperty('user');
  });

  it('throws 404 when user is not found', async () => {
    const repo = createMockUserRepo();
    repo.findSafeById.mockResolvedValue(null);

    const service = new AuthService(repo);
    await expect(service.getMe('nonexistent')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── forgotPassword ────────────────────────────────────────────────────────────

describe('AuthService.forgotPassword', () => {
  it('generates and stores a reset token for an existing user', async () => {
    const repo = createMockUserRepo();
    repo.findOne.mockResolvedValue(buildMockUser());
    repo.setPasswordResetToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    const result = await service.forgotPassword('dev@devwatch.io');

    expect(result).toHaveProperty('resetToken');
    expect(repo.setPasswordResetToken).toHaveBeenCalled();
  });

  it('returns an empty object for unknown emails (no enumeration)', async () => {
    const repo = createMockUserRepo();
    repo.findOne.mockResolvedValue(null);

    const service = new AuthService(repo);
    const result = await service.forgotPassword('ghost@devwatch.io');

    expect(result).toEqual({});
    expect(repo.setPasswordResetToken).not.toHaveBeenCalled();
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('AuthService.resetPassword', () => {
  it('updates the password and invalidates tokens on success', async () => {
    const repo = createMockUserRepo();
    repo.findByPasswordResetToken.mockResolvedValue(buildMockUser());
    repo.updatePassword.mockResolvedValue(null);
    repo.clearPasswordResetToken.mockResolvedValue(null);
    repo.clearRefreshToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    await service.resetPassword({ token: 'raw_token', password: 'NewSecure1!' });

    expect(repo.updatePassword).toHaveBeenCalled();
    expect(repo.clearPasswordResetToken).toHaveBeenCalled();
    expect(repo.clearRefreshToken).toHaveBeenCalled();
  });

  it('throws 400 when the reset token is invalid or expired', async () => {
    const repo = createMockUserRepo();
    repo.findByPasswordResetToken.mockResolvedValue(null);

    const service = new AuthService(repo);
    await expect(
      service.resetPassword({ token: 'invalid_token', password: 'NewSecure1!' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
