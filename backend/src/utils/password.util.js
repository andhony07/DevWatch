/**
 * @fileoverview Password and secure-token utilities.
 *
 * Centralises all cryptographic operations so no auth logic is scattered:
 *   - hashPassword    — bcrypt hashing with configured salt rounds
 *   - comparePassword — constant-time bcrypt comparison
 *   - generateSecureToken — cryptographically random hex token for
 *                           password reset and email verification
 *   - hashToken       — SHA-256 hex digest for safe DB storage of
 *                       the raw token sent to the user
 *
 * Design notes:
 *   - Passwords are NEVER logged or returned after hashing.
 *   - The User model pre-save hook also hashes via bcrypt; this utility
 *     is used when bypassing the hook (e.g. direct updatePassword calls).
 *   - Reset/verification tokens are generated raw (sent to user) and
 *     stored as SHA-256 hashes (never the raw value).
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { APP_CONSTANTS } from '../constants/appConstants.js';

const { PASSWORD } = APP_CONSTANTS;

// ── bcrypt ────────────────────────────────────────────────────────────────────

/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param {string} plainPassword - The raw password string
 * @returns {Promise<string>} bcrypt hash
 */
export const hashPassword = (plainPassword) => bcrypt.hash(plainPassword, PASSWORD.SALT_ROUNDS);

/**
 * Compares a plain-text password against a bcrypt hash.
 * Uses bcrypt's constant-time comparison to prevent timing attacks.
 *
 * @param {string} plainPassword  - Candidate password
 * @param {string} hashedPassword - Stored bcrypt hash
 * @returns {Promise<boolean>}
 */
export const comparePassword = (plainPassword, hashedPassword) =>
  bcrypt.compare(plainPassword, hashedPassword);

// ── Secure Token Generation ───────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random hex token.
 * The raw token is sent to the user (e.g. in a reset-password email URL).
 *
 * @param {number} [byteLength=32] - Number of random bytes (hex length = byteLength * 2)
 * @returns {string} Hex-encoded random token (64 chars by default)
 */
export const generateSecureToken = (byteLength = 32) =>
  crypto.randomBytes(byteLength).toString('hex');

/**
 * Produces a SHA-256 hex digest of a raw token.
 * Store this hash in the database; never the raw token.
 *
 * @param {string} rawToken - The raw token sent to the user
 * @returns {string} SHA-256 hex digest
 */
export const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');
