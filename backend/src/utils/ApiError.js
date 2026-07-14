/**
 * @fileoverview Custom API error class for all operational application errors.
 * Extends the native Error class with HTTP status codes, structured error arrays,
 * and an isOperational flag to distinguish expected from unexpected failures.
 */

import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * @class ApiError
 * @extends {Error}
 *
 * @example
 * // Throw a 404 with a specific message
 * throw ApiError.notFound('User with this ID does not exist.');
 *
 * @example
 * // Throw a 422 with field-level validation errors
 * throw new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Validation failed', [
 *   { field: 'email', message: 'Must be a valid email address.' },
 * ]);
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code for the response
   * @param {string} message - Human-readable error description
   * @param {Array<{ field?: string; message: string }>} [errors=[]] - Field-level or detailed errors
   * @param {string} [stack=''] - Optional stack override (used when re-wrapping errors)
   */
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.isOperational = true;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ── Static Factory Methods ────────────────────────────────────────────────

  /**
   * 400 Bad Request — malformed syntax or invalid parameters.
   * @param {string} [message='Bad Request']
   * @param {Array<{ field?: string; message: string }>} [errors=[]]
   * @returns {ApiError}
   */
  static badRequest(message = 'Bad Request', errors = []) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errors);
  }

  /**
   * 401 Unauthorized — missing or invalid authentication.
   * @param {string} [message='Unauthorized']
   * @returns {ApiError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  /**
   * 403 Forbidden — authenticated but insufficient permissions.
   * @param {string} [message='Forbidden']
   * @returns {ApiError}
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  /**
   * 404 Not Found — resource does not exist.
   * @param {string} [message='Resource not found']
   * @returns {ApiError}
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  /**
   * 409 Conflict — resource already exists or state conflict.
   * @param {string} [message='Resource already exists']
   * @returns {ApiError}
   */
  static conflict(message = 'Resource already exists') {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  /**
   * 422 Unprocessable Entity — business rule validation failure.
   * @param {string} [message='Validation failed']
   * @param {Array<{ field?: string; message: string }>} [errors=[]]
   * @returns {ApiError}
   */
  static unprocessable(message = 'Validation failed', errors = []) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errors);
  }

  /**
   * 429 Too Many Requests — rate limit exceeded.
   * @param {string} [message='Too many requests']
   * @returns {ApiError}
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }

  /**
   * 500 Internal Server Error — unexpected server-side failure.
   * @param {string} [message='Internal Server Error']
   * @returns {ApiError}
   */
  static internal(message = 'Internal Server Error') {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }

  /**
   * 501 Not Implemented — endpoint exists but logic is not yet available.
   * @param {string} [message='Not Implemented']
   * @returns {ApiError}
   */
  static notImplemented(message = 'Not Implemented') {
    return new ApiError(HTTP_STATUS.NOT_IMPLEMENTED, message);
  }
}
