/**
 * @fileoverview Authentication routes — Phase 4 production implementation.
 *
 * All stub handlers from Phase 2 have been replaced with:
 *   1. Input validation via the existing `validate` middleware
 *   2. Async error wrapping via `catchAsync`
 *   3. Real controller methods from AuthController
 *
 * Protected routes require a valid JWT access token via the `authenticate`
 * middleware. Role-based guarding uses `authorize(...roles)` from the same file.
 *
 * Registered endpoints:
 *   POST   /api/v1/auth/register          (public)
 *   POST   /api/v1/auth/login             (public)
 *   POST   /api/v1/auth/refresh           (public — uses cookie or body token)
 *   POST   /api/v1/auth/forgot-password   (public)
 *   PATCH  /api/v1/auth/reset-password    (public)
 *   POST   /api/v1/auth/logout            (protected)
 *   GET    /api/v1/auth/me                (protected)
 *   GET    /api/v1/auth/verify-email      (public — token in query param)
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Singleton controller instance — all methods are bound in the constructor
const authController = new AuthController();

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', validate(registerSchema), catchAsync(authController.register));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and issue JWT access + refresh tokens
 * @access  Public
 */
router.post('/login', validate(loginSchema), catchAsync(authController.login));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Issue a new access token using a valid refresh token
 * @access  Public (token from signed cookie or request body)
 */
router.post('/refresh', catchAsync(authController.refresh));

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Trigger password reset — generates and stores a reset token
 * @access  Public
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  catchAsync(authController.forgotPassword)
);

/**
 * @route   PATCH /api/v1/auth/reset-password
 * @desc    Reset password using a valid reset token
 * @access  Public
 */
router.patch(
  '/reset-password',
  validate(resetPasswordSchema),
  catchAsync(authController.resetPassword)
);

/**
 * @route   GET /api/v1/auth/verify-email
 * @desc    Verify email address using a token from the verification link
 * @access  Public (?token=<rawToken>)
 */
router.get('/verify-email', catchAsync(authController.verifyEmail));

// ── Protected Routes ──────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Invalidate the current refresh token and clear cookie
 * @access  Protected (Bearer token required)
 */
router.post('/logout', authenticate, catchAsync(authController.logout));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Return the authenticated user's profile (no password)
 * @access  Protected (Bearer token required)
 */
router.get('/me', authenticate, catchAsync(authController.getMe));

export default router;
