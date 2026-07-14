/**
 * @fileoverview Monitoring request validator schemas — Phase 6.
 *
 * Each schema exposes a `validate(data)` method returning:
 *   { isValid: boolean, errors: Array<{ field: string; message: string }> }
 *
 * This matches the existing contract consumed by the `validate` middleware
 * in `src/middleware/validate.middleware.js` with no modifications needed.
 *
 * Schemas:
 *   createMonitoringSchema  — POST /api/v1/monitoring
 *   monitoringQuerySchema   — GET /api/v1/monitoring/history & /latest
 *   analyticsQuerySchema    — GET /api/v1/monitoring/analytics
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * @param {Array<{field:string;message:string}>} errors
 * @param {string} field
 * @param {string} message
 */
const addError = (errors, field, message) => errors.push({ field, message });

/**
 * Returns true for a valid MongoDB ObjectId string (24-character hex).
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

/**
 * Validates a numeric metric field that must be within [min, max].
 * The field is optional — undefined/null values pass without error.
 *
 * @param {unknown} value
 * @param {string}  fieldName
 * @param {number}  min
 * @param {number}  max
 * @param {Array}   errors
 */
const validateOptionalPercent = (value, fieldName, min, max, errors) => {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'number' || isNaN(value)) {
    addError(errors, fieldName, `${fieldName} must be a number.`);
    return;
  }
  if (value < min || value > max) {
    addError(errors, fieldName, `${fieldName} must be between ${min} and ${max}.`);
  }
};

// ── Create Monitoring Schema ──────────────────────────────────────────────────

/**
 * Validates the body of POST /api/v1/monitoring.
 * Required: projectId
 * Optional: all metric fields (at least one should be present, but not enforced
 *           here — partial snapshots are permitted by the model).
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const createMonitoringSchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const {
      projectId,
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkUsage,
      responseTime,
      availability,
      errorRate,
      collectedAt,
    } = data;

    // projectId — required, valid ObjectId
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      addError(errors, 'projectId', 'projectId is required.');
    } else if (!isValidObjectId(projectId.trim())) {
      addError(errors, 'projectId', 'projectId must be a valid MongoDB ObjectId.');
    }

    // Metric fields — all optional, 0–100 percentages
    validateOptionalPercent(cpuUsage, 'cpuUsage', 0, 100, errors);
    validateOptionalPercent(memoryUsage, 'memoryUsage', 0, 100, errors);
    validateOptionalPercent(diskUsage, 'diskUsage', 0, 100, errors);
    validateOptionalPercent(availability, 'availability', 0, 100, errors);
    validateOptionalPercent(errorRate, 'errorRate', 0, 100, errors);

    // responseTime — optional, non-negative
    if (responseTime !== undefined && responseTime !== null) {
      if (typeof responseTime !== 'number' || isNaN(responseTime)) {
        addError(errors, 'responseTime', 'responseTime must be a number.');
      } else if (responseTime < 0) {
        addError(errors, 'responseTime', 'responseTime cannot be negative.');
      }
    }

    // networkUsage — optional object
    if (networkUsage !== undefined && networkUsage !== null) {
      if (typeof networkUsage !== 'object' || Array.isArray(networkUsage)) {
        addError(errors, 'networkUsage', 'networkUsage must be an object.');
      } else {
        const { inbound, outbound } = networkUsage;
        if (inbound !== undefined && inbound !== null) {
          if (typeof inbound !== 'number' || inbound < 0) {
            addError(
              errors,
              'networkUsage.inbound',
              'networkUsage.inbound must be a non-negative number.'
            );
          }
        }
        if (outbound !== undefined && outbound !== null) {
          if (typeof outbound !== 'number' || outbound < 0) {
            addError(
              errors,
              'networkUsage.outbound',
              'networkUsage.outbound must be a non-negative number.'
            );
          }
        }
      }
    }

    // collectedAt — optional, must be a valid date if provided
    if (collectedAt !== undefined && collectedAt !== null) {
      if (isNaN(new Date(collectedAt).getTime())) {
        addError(errors, 'collectedAt', 'collectedAt must be a valid ISO date string.');
      }
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Monitoring Query Schema ───────────────────────────────────────────────────

/**
 * Validates query parameters for GET /api/v1/monitoring/history and /latest.
 * All params are optional.
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const monitoringQuerySchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const { projectId, page, limit, sortBy, sortOrder, startDate, endDate } = data;

    const VALID_SORT_BY = ['timestamp', 'cpuUsage', 'memoryUsage', 'responseTime', 'collectedAt'];
    const VALID_SORT_ORDER = ['asc', 'desc'];

    // projectId — optional but must be valid ObjectId if provided
    if (projectId !== undefined && projectId !== null && projectId !== '') {
      if (!isValidObjectId(String(projectId).trim())) {
        addError(errors, 'projectId', 'projectId must be a valid MongoDB ObjectId.');
      }
    }

    // page
    if (page !== undefined) {
      const pageNum = parseInt(page, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        addError(errors, 'page', 'page must be a positive integer.');
      }
    }

    // limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        addError(errors, 'limit', 'limit must be an integer between 1 and 100.');
      }
    }

    // sortBy
    if (sortBy !== undefined && !VALID_SORT_BY.includes(sortBy)) {
      addError(errors, 'sortBy', `sortBy must be one of: ${VALID_SORT_BY.join(', ')}.`);
    }

    // sortOrder
    if (sortOrder !== undefined && !VALID_SORT_ORDER.includes(sortOrder)) {
      addError(errors, 'sortOrder', 'sortOrder must be "asc" or "desc".');
    }

    // startDate
    if (startDate !== undefined && startDate !== null && startDate !== '') {
      if (isNaN(new Date(startDate).getTime())) {
        addError(errors, 'startDate', 'startDate must be a valid ISO date string.');
      }
    }

    // endDate
    if (endDate !== undefined && endDate !== null && endDate !== '') {
      if (isNaN(new Date(endDate).getTime())) {
        addError(errors, 'endDate', 'endDate must be a valid ISO date string.');
      }
    }

    // Date range consistency
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        addError(errors, 'dateRange', 'startDate must be before endDate.');
      }
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Analytics Query Schema ────────────────────────────────────────────────────

/**
 * Validates query parameters for GET /api/v1/monitoring/analytics.
 * projectId is required.
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const analyticsQuerySchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const { projectId, startDate, endDate, granularity } = data;

    const VALID_GRANULARITY = ['hour', 'day'];

    // projectId — required
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      addError(errors, 'projectId', 'projectId is required for analytics.');
    } else if (!isValidObjectId(projectId.trim())) {
      addError(errors, 'projectId', 'projectId must be a valid MongoDB ObjectId.');
    }

    // granularity — optional enum
    if (granularity !== undefined && !VALID_GRANULARITY.includes(granularity)) {
      addError(
        errors,
        'granularity',
        `granularity must be one of: ${VALID_GRANULARITY.join(', ')}.`
      );
    }

    // startDate
    if (startDate !== undefined && startDate !== null && startDate !== '') {
      if (isNaN(new Date(startDate).getTime())) {
        addError(errors, 'startDate', 'startDate must be a valid ISO date string.');
      }
    }

    // endDate
    if (endDate !== undefined && endDate !== null && endDate !== '') {
      if (isNaN(new Date(endDate).getTime())) {
        addError(errors, 'endDate', 'endDate must be a valid ISO date string.');
      }
    }

    // Date range consistency
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        addError(errors, 'dateRange', 'startDate must be before endDate.');
      }
    }

    return { isValid: errors.length === 0, errors };
  },
};
