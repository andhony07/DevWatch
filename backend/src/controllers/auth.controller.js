/**
 * @fileoverview AuthController — thin HTTP adapter for the AuthService.
 *
 * Responsibilities:
 *   - Extract validated data from req.body (validation already ran in middleware)
 *   - Build DTOs and delegate to AuthService
 *   - Set / clear HTTP-only cookies for refresh tokens
 *   - Return standardized ApiResponse envelopes
 *   - Never contain business logic
 *
 * All methods are wrapped with catchAsync by the router.
 * Errors thrown by AuthService propagate to the global error middleware.
 */

import { AuthService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
  RegisterDTO,
  LoginDTO,
  RefreshTokenDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
} from '../dto/auth/auth.dto.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';
import { config } from '../config/env.js';

const { JWT } = APP_CONSTANTS;

// ── Cookie Helpers ────────────────────────────────────────────────────────────

/**
 * Sets the refresh token as an HTTP-only signed cookie.
 *
 * @param {import('express').Response} res
 * @param {string} refreshToken - Raw refresh JWT
 */
const setRefreshCookie = (res, refreshToken) => {
  res.cookie(JWT.REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'strict' : 'lax',
    signed: true,
    maxAge: JWT.COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  });
};

/**
 * Clears the refresh token cookie.
 *
 * @param {import('express').Response} res
 */
const clearRefreshCookie = (res) => {
  res.clearCookie(JWT.REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
};

// ── Controller ────────────────────────────────────────────────────────────────

export class AuthController {
  /**
   * @param {AuthService} [authService] - Optional injection for testing
   */
  constructor(authService = new AuthService()) {
    this.authService = authService;

    // Bind all methods so they survive router destructuring
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.refresh = this.refresh.bind(this);
    this.getMe = this.getMe.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
  }

  // ── POST /auth/register ─────────────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async register(req, res) {
    const dto = RegisterDTO.fromRequest(req.body);
    const { user } = await this.authService.register(dto);
    return ApiResponse.created(res, MESSAGES.AUTH.REGISTER_SUCCESS, { user });
  }

  // ── POST /auth/login ────────────────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async login(req, res) {
    const dto = LoginDTO.fromRequest(req.body);
    const { user, accessToken, refreshToken } = await this.authService.login(dto);

    setRefreshCookie(res, refreshToken);

    return ApiResponse.ok(res, MESSAGES.AUTH.LOGIN_SUCCESS, {
      user,
      accessToken,
      refreshToken,
    });
  }

  // ── POST /auth/logout ───────────────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async logout(req, res) {
    await this.authService.logout(req.user.sub);
    clearRefreshCookie(res);
    return ApiResponse.ok(res, MESSAGES.AUTH.LOGOUT_SUCCESS);
  }

  // ── POST /auth/refresh ──────────────────────────────────────────────────────

  /**
   * Accepts the refresh token from either the request body OR the signed cookie.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async refresh(req, res) {
    // Cookie takes precedence; fall back to body for API clients
    const rawRefreshToken = req.signedCookies?.[JWT.REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;

    if (!rawRefreshToken) {
      throw ApiError.unauthorized(MESSAGES.AUTH.REFRESH_TOKEN_MISSING);
    }

    const dto = RefreshTokenDTO.fromRequest({ refreshToken: rawRefreshToken });
    const { accessToken, refreshToken } = await this.authService.refreshToken(dto.refreshToken);

    setRefreshCookie(res, refreshToken);

    return ApiResponse.ok(res, MESSAGES.AUTH.REFRESH_SUCCESS, {
      accessToken,
      refreshToken,
    });
  }

  // ── GET /auth/me ────────────────────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getMe(req, res) {
    const { user } = await this.authService.getMe(req.user.sub);
    return ApiResponse.ok(res, MESSAGES.AUTH.PROFILE_FETCHED, { user });
  }

  // ── POST /auth/forgot-password ──────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async forgotPassword(req, res) {
    const dto = ForgotPasswordDTO.fromRequest(req.body);
    const result = await this.authService.forgotPassword(dto.email);

    // In development, expose the raw token in the response for testing.
    // In production, this would be emailed and never returned via HTTP.
    const data = config.isDevelopment && result.resetToken ? { resetToken: result.resetToken } : {};

    return ApiResponse.ok(res, MESSAGES.AUTH.PASSWORD_RESET_SENT, data);
  }

  // ── PATCH /auth/reset-password ──────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async resetPassword(req, res) {
    const dto = ResetPasswordDTO.fromRequest(req.body);
    await this.authService.resetPassword(dto);
    return ApiResponse.ok(res, MESSAGES.AUTH.PASSWORD_RESET_SUCCESS);
  }

  // ── GET /auth/verify-email ──────────────────────────────────────────────────

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async verifyEmail(req, res) {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      throw ApiError.badRequest(MESSAGES.AUTH.EMAIL_VERIFY_TOKEN_INVALID);
    }
    const { user } = await this.authService.verifyEmail(token);
    return ApiResponse.ok(res, MESSAGES.AUTH.EMAIL_VERIFIED, { user });
  }
}
