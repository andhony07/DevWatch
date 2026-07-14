/**
 * @fileoverview Authentication routes.
 *
 * Declares all auth endpoints with correct HTTP methods, paths, and middleware.
 * Route handlers are intentionally stubbed for Phase 2 initialization.
 * Full implementations (controllers, services, models) will be wired in Phase 3.
 *
 * Registered endpoints:
 *   POST   /api/v1/auth/register
 *   POST   /api/v1/auth/login
 *   POST   /api/v1/auth/logout        (protected)
 *   POST   /api/v1/auth/refresh
 *   GET    /api/v1/auth/me            (protected)
 *   POST   /api/v1/auth/forgot-password
 *   PATCH  /api/v1/auth/reset-password
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const router = Router();

/** Shared stub response for Phase 2 initialization. */
const phase3Stub = (endpoint) => (_req, res) => {
  res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
    success: false,
    statusCode: HTTP_STATUS.NOT_IMPLEMENTED,
    message: 'Authentication module will be fully implemented in Phase 3.',
    endpoint,
    timestamp: new Date().toISOString(),
  });
};

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', phase3Stub('POST /api/v1/auth/register'));

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT tokens
 * @access  Public
 */
router.post('/login', phase3Stub('POST /api/v1/auth/login'));

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using a valid refresh token
 * @access  Public
 */
router.post('/refresh', phase3Stub('POST /api/v1/auth/refresh'));

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', phase3Stub('POST /api/v1/auth/forgot-password'));

/**
 * @route   PATCH /api/v1/auth/reset-password
 * @desc    Reset password using a valid reset token
 * @access  Public
 */
router.patch('/reset-password', phase3Stub('PATCH /api/v1/auth/reset-password'));

// ── Protected Routes ──────────────────────────────────────────────────────────

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Invalidate the current session / token
 * @access  Protected
 */
router.post('/logout', authenticate, phase3Stub('POST /api/v1/auth/logout'));

/**
 * @route   GET /api/v1/auth/me
 * @desc    Return the currently authenticated user's profile
 * @access  Protected
 */
router.get('/me', authenticate, phase3Stub('GET /api/v1/auth/me'));

export default router;
