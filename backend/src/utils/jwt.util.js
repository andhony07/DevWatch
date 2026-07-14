/**
 * @fileoverview JWT utility — access token and refresh token lifecycle management.
 *
 * Responsibilities:
 *   - Sign access tokens (short-lived, RS256-compatible HS256 default)
 *   - Sign refresh tokens (long-lived, separate secret)
 *   - Verify both token types with appropriate secrets
 *   - Decode without verification (for logging / debugging only)
 *
 * Never call these functions with raw passwords or sensitive data as payload.
 * The payload should only carry: { sub, role, email }.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';

const { JWT } = APP_CONSTANTS;

// ── Payload Builder ────────────────────────────────────────────────────────────

/**
 * Builds a minimal, non-sensitive JWT payload from a user document.
 *
 * @param {object} user - Mongoose user document or plain object
 * @param {string|import('mongoose').Types.ObjectId} user.id - User primary key
 * @param {string} user.email  - User email
 * @param {string} user.role   - User role
 * @returns {{ sub: string; email: string; role: string }}
 */
const buildPayload = (user) => ({
  sub: String(user.id ?? user._id),
  email: user.email,
  role: user.role,
});

// ── Access Token ──────────────────────────────────────────────────────────────

/**
 * Signs and returns a short-lived JWT access token.
 *
 * @param {object} user - User document with id, email, role
 * @returns {string} Signed JWT string
 */
export const signAccessToken = (user) =>
  jwt.sign(buildPayload(user), config.jwt.secret, {
    algorithm: JWT.ALGORITHM,
    expiresIn: config.jwt.expire,
  });

/**
 * Verifies a JWT access token and returns the decoded payload.
 *
 * @param {string} token - Raw JWT string
 * @returns {{ sub: string; email: string; role: string; iat: number; exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export const verifyAccessToken = (token) =>
  jwt.verify(token, config.jwt.secret, {
    algorithms: [JWT.ALGORITHM],
  });

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * Signs and returns a long-lived JWT refresh token.
 * Uses a separate secret to allow independent revocation.
 *
 * @param {object} user - User document with id, email, role
 * @returns {string} Signed JWT refresh token string
 */
export const signRefreshToken = (user) =>
  jwt.sign(buildPayload(user), config.jwt.refreshSecret, {
    algorithm: JWT.ALGORITHM,
    expiresIn: config.jwt.refreshExpire,
  });

/**
 * Verifies a JWT refresh token and returns the decoded payload.
 *
 * @param {string} token - Raw refresh token string
 * @returns {{ sub: string; email: string; role: string; iat: number; exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export const verifyRefreshToken = (token) =>
  jwt.verify(token, config.jwt.refreshSecret, {
    algorithms: [JWT.ALGORITHM],
  });

// ── Decode (no verification) ──────────────────────────────────────────────────

/**
 * Decodes a JWT without verifying the signature.
 * Use only for logging or inspecting token metadata — never for auth decisions.
 *
 * @param {string} token - Raw JWT string
 * @returns {object | null}
 */
export const decodeToken = (token) => jwt.decode(token);
