/**
 * @fileoverview Unit tests for password.util.js
 *
 * Tests cover:
 *   - hashPassword        — returns a bcrypt hash, not the original string
 *   - comparePassword     — correctly matches and rejects passwords
 *   - generateSecureToken — returns a hex string of expected length
 *   - hashToken           — deterministic SHA-256 hex output
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

import {
  hashPassword,
  comparePassword,
  generateSecureToken,
  hashToken,
} from '../../src/utils/password.util.js';

describe('password.util — hashPassword', () => {
  it('returns a string different from the original password', async () => {
    const plain = 'MySecurePass1!';
    const hashed = await hashPassword(plain);
    expect(typeof hashed).toBe('string');
    expect(hashed).not.toBe(plain);
  });

  it('produces different hashes for the same input (salt randomisation)', async () => {
    const plain = 'MySecurePass1!';
    const [hash1, hash2] = await Promise.all([hashPassword(plain), hashPassword(plain)]);
    expect(hash1).not.toBe(hash2);
  });

  it('generates a bcrypt hash beginning with $2b$', async () => {
    const hashed = await hashPassword('Password123!');
    expect(hashed.startsWith('$2b$')).toBe(true);
  });
});

describe('password.util — comparePassword', () => {
  it('returns true for the correct plain-text password', async () => {
    const plain = 'MySecurePass1!';
    const hashed = await hashPassword(plain);
    const result = await comparePassword(plain, hashed);
    expect(result).toBe(true);
  });

  it('returns false for an incorrect password', async () => {
    const hashed = await hashPassword('CorrectPassword1!');
    const result = await comparePassword('WrongPassword1!', hashed);
    expect(result).toBe(false);
  });

  it('returns false for an empty string', async () => {
    const hashed = await hashPassword('SomePassword1!');
    const result = await comparePassword('', hashed);
    expect(result).toBe(false);
  });
});

describe('password.util — generateSecureToken', () => {
  it('returns a hex string of 64 characters by default (32 bytes)', () => {
    const token = generateSecureToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
  });

  it('returns unique tokens on each call', () => {
    const [t1, t2] = [generateSecureToken(), generateSecureToken()];
    expect(t1).not.toBe(t2);
  });

  it('respects the byteLength parameter', () => {
    const token = generateSecureToken(16);
    expect(token).toHaveLength(32); // 16 bytes × 2 hex chars
  });
});

describe('password.util — hashToken', () => {
  it('returns a deterministic 64-character SHA-256 hex digest', () => {
    const raw = generateSecureToken();
    const h1 = hashToken(raw);
    const h2 = hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('produces different hashes for different inputs', () => {
    const h1 = hashToken(generateSecureToken());
    const h2 = hashToken(generateSecureToken());
    expect(h1).not.toBe(h2);
  });

  it('is not reversible (hash differs from raw input)', () => {
    const raw = 'myrawtoken';
    expect(hashToken(raw)).not.toBe(raw);
  });
});
