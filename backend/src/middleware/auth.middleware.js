/**
 * @fileoverview JWT authentication and role-based authorization middleware.
 *
 * `authenticate` — verifies a JWT from the Authorization header or signed cookie,
 *                  and attaches the decoded payload to req.user.
 *
 * `authorize`    — restricts access to one or more user roles.
 *                  Must always be chained after `authenticate`.
 *
 * Token lookup order:
 *   1. Authorization: Bearer <token>
 *   2. Signed cookie: devwatch_token
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';

// ── Token Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts the raw JWT string from the Authorization header or signed cookie.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieToken = req.signedCookies?.[APP_CONSTANTS.JWT.COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
};

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Authentication middleware.
 * Verifies the JWT and attaches the decoded payload to `req.user`.
 * Rejects the request with 401 if the token is absent, invalid, or expired.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
export const authenticate = (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    return next(ApiError.unauthorized(MESSAGES.AUTH.TOKEN_MISSING));
  }

  try {
    /** @type {object} */
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: [APP_CONSTANTS.JWT.ALGORITHM],
    });

    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized(MESSAGES.AUTH.TOKEN_EXPIRED));
    }
    return next(ApiError.unauthorized(MESSAGES.AUTH.TOKEN_INVALID));
  }
};

/**
 * Role-based authorization middleware factory.
 * Must be used after `authenticate` in the middleware chain.
 *
 * @param {...string} roles - One or more allowed role strings (e.g. 'admin', 'operator')
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);
 */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.AUTH.TOKEN_MISSING));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    return next();
  };
