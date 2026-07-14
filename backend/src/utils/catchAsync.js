/**
 * @fileoverview Async error forwarding wrapper for Express route handlers.
 *
 * Eliminates try/catch boilerplate in every route handler.
 * Works alongside `express-async-errors` as an explicit opt-in wrapper
 * for cases where the HOF pattern is preferred over global patching.
 *
 * @example
 * // Without catchAsync (verbose):
 * router.get('/users', async (req, res, next) => {
 *   try {
 *     const users = await UserService.findAll();
 *     res.json(users);
 *   } catch (err) {
 *     next(err);
 *   }
 * });
 *
 * @example
 * // With catchAsync (clean):
 * router.get('/users', catchAsync(async (req, res) => {
 *   const users = await UserService.findAll();
 *   res.json(users);
 * }));
 */

/**
 * Wraps an async Express route handler and automatically forwards
 * any rejected promises to the next() error handler.
 *
 * @param {(
 *   req: import('express').Request,
 *   res: import('express').Response,
 *   next: import('express').NextFunction
 * ) => Promise<void>} fn - Async route handler function
 *
 * @returns {(
 *   req: import('express').Request,
 *   res: import('express').Response,
 *   next: import('express').NextFunction
 * ) => void} Express middleware function
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
