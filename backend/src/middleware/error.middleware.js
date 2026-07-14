/**
 * @fileoverview Global Express error handling middleware.
 *
 * Must be registered LAST — after all routes and other middleware.
 * Intercepts every error passed to next(err) and returns a structured,
 * consistent JSON error response.
 *
 * Handles normalization of:
 *   - ApiError (operational errors)
 *   - Mongoose ValidationError
 *   - Mongoose CastError (invalid ObjectId)
 *   - MongoDB duplicate key error (code 11000)
 *   - JWT JsonWebTokenError
 *   - JWT TokenExpiredError
 *   - All other unexpected errors (mapped to 500)
 */

import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { MESSAGES } from '../constants/messages.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../utils/helpers.js';

// ── Error Normalizer ──────────────────────────────────────────────────────────

/**
 * Converts any thrown error into a normalized ApiError instance.
 * @param {Error} err - The raw error from Express or application code
 * @returns {ApiError}
 */
const normalizeError = (err) => {
  // Already an operational ApiError — pass through unchanged.
  if (err instanceof ApiError) {
    return err;
  }

  // Mongoose field-level validation failure
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, MESSAGES.VALIDATION_ERROR, errors);
  }

  // MongoDB unique index violation
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    return new ApiError(
      HTTP_STATUS.CONFLICT,
      `The value for '${field}' is already in use. ${MESSAGES.CONFLICT}`
    );
  }

  // Mongoose CastError — invalid ObjectId or type mismatch
  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Invalid value "${err.value}" for field '${err.path}'.`
    );
  }

  // JWT signature mismatch or malformed token
  if (err.name === 'JsonWebTokenError') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
  }

  // JWT has passed its expiry date
  if (err.name === 'TokenExpiredError') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_EXPIRED);
  }

  // SyntaxError from JSON.parse (malformed request body)
  if (err instanceof SyntaxError && 'body' in err) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, 'Request body contains invalid JSON.');
  }

  // Unknown / programmer error — never expose raw message in production
  return new ApiError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isProduction() ? MESSAGES.INTERNAL_ERROR : err.message
  );
};

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Global error handler middleware.
 * Signature must have exactly 4 parameters for Express to recognize it as error middleware.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next - Required by Express, intentionally unused
 * @returns {void}
 */
export const errorMiddleware = (err, req, res, _next) => {
  const apiError = normalizeError(err);

  const logContext = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode: apiError.statusCode,
    ip: req.ip,
  };

  if (apiError.statusCode >= 500) {
    logger.error(apiError.message, { ...logContext, stack: err.stack });
  } else {
    logger.warn(apiError.message, logContext);
  }

  /** @type {object} */
  const responseBody = {
    success: false,
    statusCode: apiError.statusCode,
    message: apiError.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  if (apiError.errors.length > 0) {
    responseBody.errors = apiError.errors;
  }

  if (!isProduction() && apiError.stack) {
    responseBody.stack = apiError.stack;
  }

  res.status(apiError.statusCode).json(responseBody);
};
