/**
 * @fileoverview Unit tests for jwt.util.js
 *
 * Tests cover:
 *   - signAccessToken  — returns a string containing three dot-separated parts
 *   - verifyAccessToken — decodes the correct payload
 *   - signRefreshToken  — returns a different token from access token
 *   - verifyRefreshToken — decodes the correct payload
 *   - verifyAccessToken — throws on expired token
 *   - verifyRefreshToken — throws on wrong secret
 *   - decodeToken       — returns null for invalid JWT
 */

import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env.js';

// ── Mock env config ────────────────────────────────────────────────────────────
// Must be set before importing jwt.util.js, because env.js reads process.env
// synchronously at module load time.

process.env.JWT_SECRET = 'test_access_secret_key_minimum_32_characters';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_minimum_32_chars';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '30d';
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://localhost:27017/devwatch_test';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.SOCKET_PORT = '5000';

import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decodeToken,
} from '../../src/utils/jwt.util.js';

const mockUser = {
  id: '64c3f0e8b2a1234567890abc',
  email: 'test@devwatch.io',
  role: 'viewer',
};

describe('jwt.util — signAccessToken', () => {
  it('returns a string with three JWT segments', () => {
    const token = signAccessToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('embeds the correct sub, email, and role in the payload', () => {
    const token = signAccessToken(mockUser);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.role).toBe(mockUser.role);
  });
});

describe('jwt.util — verifyAccessToken', () => {
  it('successfully decodes a freshly signed access token', () => {
    const token = signAccessToken(mockUser);
    const result = verifyAccessToken(token);
    expect(result).toMatchObject({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it('throws JsonWebTokenError on a tampered token', () => {
    const token = `${signAccessToken(mockUser)}tampered`;
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError);
  });

  it('throws TokenExpiredError on an expired token', () => {
    const expired = jwt.sign(
      { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
      config.jwt.secret,
      { expiresIn: -1 }
    );
    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });
});

describe('jwt.util — signRefreshToken', () => {
  it('returns a token different from the access token', () => {
    const access = signAccessToken(mockUser);
    const refresh = signRefreshToken(mockUser);
    expect(access).not.toBe(refresh);
  });

  it('cannot be verified with the access token secret', () => {
    const refresh = signRefreshToken(mockUser);
    expect(() =>
      jwt.verify(refresh, config.jwt.secret)
    ).toThrow(jwt.JsonWebTokenError);
  });
});

describe('jwt.util — verifyRefreshToken', () => {
  it('successfully decodes a freshly signed refresh token', () => {
    const token = signRefreshToken(mockUser);
    const result = verifyRefreshToken(token);
    expect(result).toMatchObject({
      sub: mockUser.id,
      email: mockUser.email,
      role: mockUser.role,
    });
  });

  it('throws on an access token passed as refresh token', () => {
    const accessToken = signAccessToken(mockUser);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

describe('jwt.util — decodeToken', () => {
  it('decodes payload without verifying signature', () => {
    const token = signAccessToken(mockUser);
    const decoded = decodeToken(token);
    expect(decoded.sub).toBe(mockUser.id);
  });

  it('returns null for a completely invalid string', () => {
    const result = decodeToken('not.a.jwt');
    expect(result).toBeNull();
  });
});
