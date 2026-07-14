/**
 * @fileoverview AuthService — authentication and authorization business logic.
 *
 * Orchestrates all auth operations by coordinating:
 *   - UserRepository  (data access)
 *   - JWT utilities   (token lifecycle)
 *   - Password utilities (hashing, token generation)
 *
 * This service contains NO HTTP concerns (no req/res/next).
 * All errors are thrown as ApiError instances for the error middleware to handle.
 *
 * Methods:
 *   register(dto)               → RegisterDTO   → { user }
 *   login(dto)                  → LoginDTO      → { user, accessToken, refreshToken }
 *   refreshToken(rawToken)      → string        → { accessToken, refreshToken }
 *   logout(userId)              → string        → void
 *   getMe(userId)               → string        → { user }
 *   forgotPassword(email)       → string        → { resetToken } (raw, for email delivery)
 *   resetPassword(dto)          → ResetPasswordDTO → void
 *   verifyEmail(rawToken)       → string        → { user }
 */

import { UserRepository } from '../repositories/index.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.util.js';
import {
  hashPassword,
  comparePassword,
  generateSecureToken,
  hashToken,
} from '../utils/password.util.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { logger } from '../config/logger.js';

const { ROLES } = APP_CONSTANTS;

// Password reset token validity window — 10 minutes
const RESET_TOKEN_EXPIRES_MS = 10 * 60 * 1000;

// Email verification token validity window — 24 hours
const EMAIL_VERIFY_EXPIRES_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  /**
   * @param {UserRepository} [userRepository] - Optional injection for testing
   */
  constructor(userRepository = new UserRepository()) {
    this.userRepo = userRepository;
  }

  // ── Register ────────────────────────────────────────────────────────────────

  /**
   * Creates a new user account.
   * Assigns VIEWER role by default; admin can be set explicitly in the DTO.
   *
   * @param {import('../dto/auth/auth.dto.js').RegisterDTO} dto
   * @returns {Promise<{ user: object }>}
   */
  async register(dto) {
    const emailTaken = await this.userRepo.emailExists(dto.email);
    if (emailTaken) {
      throw ApiError.conflict(MESSAGES.AUTH.EMAIL_IN_USE);
    }

    const user = await this.userRepo.create({
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password, // Pre-save hook will hash this
      role: dto.role ?? ROLES.VIEWER,
      company: dto.company ?? null,
      status: 'active',
    });

    // Generate and store email verification token
    const rawVerifyToken = generateSecureToken();
    const hashedVerifyToken = hashToken(rawVerifyToken);
    const verifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRES_MS);

    await this.userRepo.setEmailVerificationToken(user._id, hashedVerifyToken, verifyExpires);

    logger.info(`[AuthService] New user registered: ${dto.email}`);

    return { user: user.toJSON() };
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  /**
   * Authenticates a user by email and password.
   * Returns an access token and a refresh token on success.
   *
   * @param {import('../dto/auth/auth.dto.js').LoginDTO} dto
   * @returns {Promise<{ user: object; accessToken: string; refreshToken: string }>}
   */
  async login(dto) {
    // Load user with password hash (select: +password)
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    const passwordMatch = await comparePassword(dto.password, user.password);
    if (!passwordMatch) {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_INACTIVE);
    }

    // Sign tokens
    const accessToken = signAccessToken(user);
    const rawRefreshToken = signRefreshToken(user);

    // Hash the refresh token for storage (never store raw JWTs)
    const hashedRefreshToken = hashToken(rawRefreshToken);
    await this.userRepo.storeRefreshToken(user._id, hashedRefreshToken);

    // Update lastLogin timestamp
    await this.userRepo.updateLastLogin(user._id);

    logger.info(`[AuthService] User logged in: ${dto.email}`);

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────────

  /**
   * Validates a refresh token, rotates it, and returns a new access token.
   *
   * Token rotation strategy:
   *   1. Verify JWT signature and expiry
   *   2. Hash the incoming raw token and compare against DB
   *   3. Issue a new access token + new refresh token
   *   4. Store the new refresh token hash (old one is invalidated)
   *
   * @param {string} rawRefreshToken - The raw refresh JWT from the client
   * @returns {Promise<{ accessToken: string; refreshToken: string }>}
   */
  async refreshToken(rawRefreshToken) {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw ApiError.unauthorized(MESSAGES.AUTH.REFRESH_TOKEN_INVALID);
    }

    // Verify stored hash matches incoming token
    const user = await this.userRepo.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.refreshToken) {
      throw ApiError.unauthorized(MESSAGES.AUTH.REFRESH_TOKEN_INVALID);
    }

    const incomingHash = hashToken(rawRefreshToken);
    if (incomingHash !== user.refreshToken) {
      // Possible replay attack — invalidate all tokens for this user
      await this.userRepo.clearRefreshToken(user._id);
      throw ApiError.unauthorized(MESSAGES.AUTH.REFRESH_TOKEN_INVALID);
    }

    if (user.status !== 'active') {
      throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_INACTIVE);
    }

    // Rotate: issue new tokens
    const newAccessToken = signAccessToken(user);
    const newRawRefreshToken = signRefreshToken(user);
    const newHashedRefreshToken = hashToken(newRawRefreshToken);

    await this.userRepo.storeRefreshToken(user._id, newHashedRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  // ── Logout ────────────────────────────────────────────────────────────────────

  /**
   * Invalidates the stored refresh token for a user.
   *
   * @param {string} userId - The authenticated user's ID (from req.user.sub)
   * @returns {Promise<void>}
   */
  async logout(userId) {
    await this.userRepo.clearRefreshToken(userId);
    logger.info(`[AuthService] User logged out: ${userId}`);
  }

  // ── Get Current User ──────────────────────────────────────────────────────────

  /**
   * Returns the authenticated user's public profile.
   *
   * @param {string} userId - Decoded from the access token (req.user.sub)
   * @returns {Promise<{ user: object }>}
   */
  async getMe(userId) {
    const user = await this.userRepo.findSafeById(userId);
    if (!user) {
      throw ApiError.notFound(MESSAGES.NOT_FOUND);
    }
    return { user: user.toJSON() };
  }

  // ── Forgot Password ───────────────────────────────────────────────────────────

  /**
   * Generates a password reset token and persists its hash.
   * Returns the raw token for inclusion in the reset email.
   *
   * In production, pass `rawToken` to a mailer service.
   * The raw token MUST NOT be stored in the database.
   *
   * @param {string} email
   * @returns {Promise<{ resetToken: string }>}
   */
  async forgotPassword(email) {
    const user = await this.userRepo.findOne({ email: email.toLowerCase().trim() });

    // Return the same response even when the user does not exist
    // to prevent user enumeration via timing differences.
    if (!user) {
      logger.warn(`[AuthService] forgotPassword requested for unknown email: ${email}`);
      return {};
    }

    const rawToken = generateSecureToken();
    const hashedToken = hashToken(rawToken);
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MS);

    await this.userRepo.setPasswordResetToken(user._id, hashedToken, expires);

    logger.info(`[AuthService] Password reset token generated for: ${email}`);

    // In production, dispatch email via mailer service here.
    // The raw token would be embedded in the reset URL.
    return { resetToken: rawToken };
  }

  // ── Reset Password ────────────────────────────────────────────────────────────

  /**
   * Resets the user's password using a valid reset token.
   * Clears the reset token fields and all active refresh tokens after reset.
   *
   * @param {import('../dto/auth/auth.dto.js').ResetPasswordDTO} dto
   * @returns {Promise<void>}
   */
  async resetPassword(dto) {
    const hashedToken = hashToken(dto.token);
    const user = await this.userRepo.findByPasswordResetToken(hashedToken);

    if (!user) {
      throw ApiError.badRequest(MESSAGES.AUTH.PASSWORD_RESET_TOKEN_INVALID);
    }

    const newHashedPassword = await hashPassword(dto.password);

    // Update password directly (bypassing the pre-save hook) to avoid double-hashing.
    await this.userRepo.updatePassword(user._id, newHashedPassword);

    // Invalidate reset token and any active sessions
    await Promise.all([
      this.userRepo.clearPasswordResetToken(user._id),
      this.userRepo.clearRefreshToken(user._id),
    ]);

    logger.info(`[AuthService] Password reset completed for user: ${String(user._id)}`);
  }

  // ── Email Verification ────────────────────────────────────────────────────────

  /**
   * Verifies a user's email address using the verification token.
   *
   * @param {string} rawToken - Raw verification token from the email link
   * @returns {Promise<{ user: object }>}
   */
  async verifyEmail(rawToken) {
    const hashedToken = hashToken(rawToken);
    const user = await this.userRepo.findByEmailVerificationToken(hashedToken);

    if (!user) {
      throw ApiError.badRequest(MESSAGES.AUTH.EMAIL_VERIFY_TOKEN_INVALID);
    }

    if (user.emailVerified) {
      throw ApiError.conflict(MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED);
    }

    const updatedUser = await this.userRepo.verifyEmail(user._id);

    logger.info(`[AuthService] Email verified for user: ${String(user._id)}`);

    return { user: updatedUser.toJSON() };
  }
}
