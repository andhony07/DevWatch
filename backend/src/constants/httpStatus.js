/**
 * @fileoverview HTTP status code constants.
 * Single source of truth for all HTTP status codes used across the application.
 * Eliminates magic numbers and ensures consistency.
 */

/**
 * Standard HTTP status codes organized by category.
 * @type {Readonly<Record<string, number>>}
 */
export const HTTP_STATUS = Object.freeze({
  // ── 2xx Success ────────────────────────────────────────────
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // ── 3xx Redirection ────────────────────────────────────────
  NOT_MODIFIED: 304,
  PERMANENT_REDIRECT: 308,

  // ── 4xx Client Errors ──────────────────────────────────────
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // ── 5xx Server Errors ──────────────────────────────────────
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});
