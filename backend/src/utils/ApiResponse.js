/**
 * @fileoverview Standardized API response builder.
 * All successful HTTP responses are constructed through this class to ensure
 * a consistent response envelope across the entire API surface.
 *
 * Response shape:
 * {
 *   success: boolean,
 *   statusCode: number,
 *   message: string,
 *   data?: T,
 *   meta?: object,
 *   timestamp: string
 * }
 */

import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * @template T
 * @class ApiResponse
 */
export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Response message
   * @param {T | null} [data=null] - Response payload
   * @param {object | null} [meta=null] - Pagination or supplemental metadata
   */
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    this.timestamp = new Date().toISOString();

    if (data !== null && data !== undefined) {
      this.data = data;
    }

    if (meta !== null && meta !== undefined) {
      this.meta = meta;
    }
  }

  // ── Static Helpers ────────────────────────────────────────────────────────

  /**
   * Sends a 200 OK JSON response.
   * @param {import('express').Response} res
   * @param {string} message
   * @param {T} [data]
   * @param {object | null} [meta]
   * @returns {import('express').Response}
   */
  static ok(res, message, data, meta = null) {
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, message, data, meta));
  }

  /**
   * Sends a 201 Created JSON response.
   * @param {import('express').Response} res
   * @param {string} message
   * @param {T} [data]
   * @returns {import('express').Response}
   */
  static created(res, message, data) {
    return res
      .status(HTTP_STATUS.CREATED)
      .json(new ApiResponse(HTTP_STATUS.CREATED, message, data));
  }

  /**
   * Sends a 204 No Content response (empty body).
   * @param {import('express').Response} res
   * @returns {import('express').Response}
   */
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Sends a paginated 200 OK response with meta object.
   * @param {import('express').Response} res
   * @param {string} message
   * @param {T[]} data
   * @param {{ page: number; limit: number; total: number }} pagination
   * @returns {import('express').Response}
   */
  static paginated(res, message, data, pagination) {
    const meta = ApiResponse.buildPaginationMeta(
      pagination.page,
      pagination.limit,
      pagination.total
    );
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, message, data, meta));
  }

  /**
   * Builds a standardized pagination metadata object.
   * @param {number} page - Current page number (1-indexed)
   * @param {number} limit - Items per page
   * @param {number} total - Total number of records
   * @returns {{ page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }}
   */
  static buildPaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
