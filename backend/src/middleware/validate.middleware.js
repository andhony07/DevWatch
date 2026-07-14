/**
 * @fileoverview Request validation middleware factory.
 *
 * Provides two validation strategies:
 *
 *   `validate(schema, source)`  — validates req[source] against a schema object
 *                                 with a `.validate(data)` method (compatible with
 *                                 Joi, Zod adapters, or custom validators).
 *
 *   `requireFields(fields)`     — lightweight check that all named fields exist
 *                                 and are non-empty in req.body.
 */

import { ApiError } from '../utils/ApiError.js';
import { MESSAGES } from '../constants/messages.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

// ── Schema Validator ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Array<{ field: string; message: string }>} errors - Field-level errors
 */

/**
 * @typedef {Object} ValidatorSchema
 * @property {(data: object) => ValidationResult} validate - Validation function
 */

/**
 * Middleware factory that validates request data against a provided schema.
 * The schema must expose a `validate(data)` method returning `{ isValid, errors }`.
 *
 * @param {ValidatorSchema} schema - Validator with a `validate` method
 * @param {'body' | 'query' | 'params'} [source='body'] - Which part of the request to validate
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/login', validate(loginSchema), loginController);
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const data = req[source];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return next(new ApiError(HTTP_STATUS.BAD_REQUEST, MESSAGES.BAD_REQUEST));
    }

    const result = schema.validate(data);

    if (!result.isValid) {
      return next(
        new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, MESSAGES.VALIDATION_ERROR, result.errors)
      );
    }

    return next();
  };

// ── Required Fields Check ─────────────────────────────────────────────────────

/**
 * Lightweight middleware factory that checks for the presence and non-emptiness
 * of required fields in `req.body`. Suitable for simple endpoints without a
 * full validation schema.
 *
 * @param {string[]} fields - Names of required fields in req.body
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/login', requireFields(['email', 'password']), loginController);
 */
export const requireFields = (fields) => (req, _res, next) => {
  /** @type {Array<{ field: string; message: string }>} */
  const missing = [];

  for (const field of fields) {
    const value = req.body?.[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push({ field, message: `'${field}' is required and cannot be empty.` });
    }
  }

  if (missing.length > 0) {
    return next(new ApiError(HTTP_STATUS.BAD_REQUEST, MESSAGES.BAD_REQUEST, missing));
  }

  return next();
};
