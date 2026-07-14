/**
 * @fileoverview 404 Not Found middleware.
 *
 * Catches any request that passes through all registered routes without matching.
 * Must be placed after all route registrations and before the global error handler.
 */

import { ApiError } from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Generates a descriptive 404 ApiError and forwards it to the global error handler.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
export const notFoundMiddleware = (req, _res, next) => {
  next(
    new ApiError(
      HTTP_STATUS.NOT_FOUND,
      `Route '${req.method} ${req.originalUrl}' does not exist on this server.`
    )
  );
};
