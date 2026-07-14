/**
 * @fileoverview Project request validator schemas.
 *
 * Each schema exposes a `validate(data)` method returning:
 *   { isValid: boolean, errors: Array<{ field: string; message: string }> }
 *
 * This contract is consumed by the existing `validate` middleware in
 * `src/middleware/validate.middleware.js` without any modification.
 *
 * Schemas:
 *   createProjectSchema  — POST /api/v1/projects
 *   updateProjectSchema  — PATCH /api/v1/projects/:id
 *   assignMemberSchema   — POST /api/v1/projects/:id/members
 *   projectQuerySchema   — GET /api/v1/projects (query params)
 */

import {
  CLOUD_PROVIDERS,
  PROJECT_ENVIRONMENTS,
  PROJECT_STATUSES,
} from '../models/Project.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Adds an error to the collector array.
 *
 * @param {Array<{field:string;message:string}>} errors
 * @param {string} field
 * @param {string} message
 */
const addError = (errors, field, message) => errors.push({ field, message });

/**
 * Returns true for a valid HTTP/HTTPS URL string.
 *
 * @param {string} url
 * @returns {boolean}
 */
const isValidUrl = (url) => /^https?:\/\/.+/.test(url);

/**
 * Returns true for a valid MongoDB ObjectId string (24-character hex).
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

/**
 * Validates an array of tags.
 *
 * @param {unknown} tags
 * @param {Array<{field:string;message:string}>} errors
 */
const validateTags = (tags, errors) => {
  if (tags === undefined || tags === null) {
    return;
  }

  if (!Array.isArray(tags)) {
    addError(errors, 'tags', 'Tags must be an array of strings.');
    return;
  }

  if (tags.length > 20) {
    addError(errors, 'tags', 'A project cannot have more than 20 tags.');
    return;
  }

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      addError(errors, 'tags', 'Each tag must be a string.');
      return;
    }
    if (tag.trim().length === 0) {
      addError(errors, 'tags', 'Tags must not be empty strings.');
      return;
    }
    if (tag.trim().length > 50) {
      addError(errors, 'tags', 'Each tag must not exceed 50 characters.');
      return;
    }
  }
};

// ── Create Project Schema ─────────────────────────────────────────────────────

/**
 * Validates the body of POST /api/v1/projects.
 * Required: name
 * Optional: description, repositoryUrl, cloudProvider, environment, aiEnabled, tags
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const createProjectSchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const { name, description, repositoryUrl, cloudProvider, environment, aiEnabled, tags } = data;

    // name — required
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      addError(errors, 'name', 'Project name is required.');
    } else if (name.trim().length < 2) {
      addError(errors, 'name', 'Project name must be at least 2 characters.');
    } else if (name.trim().length > 100) {
      addError(errors, 'name', 'Project name must not exceed 100 characters.');
    }

    // description — optional
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        addError(errors, 'description', 'Description must be a string.');
      } else if (description.trim().length > 500) {
        addError(errors, 'description', 'Description must not exceed 500 characters.');
      }
    }

    // repositoryUrl — optional, must be valid URL if provided
    if (repositoryUrl !== undefined && repositoryUrl !== null && repositoryUrl !== '') {
      if (typeof repositoryUrl !== 'string' || !isValidUrl(repositoryUrl.trim())) {
        addError(errors, 'repositoryUrl', 'Repository URL must be a valid HTTP/HTTPS URL.');
      }
    }

    // cloudProvider — optional, must be valid enum
    if (cloudProvider !== undefined && cloudProvider !== null) {
      if (!CLOUD_PROVIDERS.includes(cloudProvider)) {
        addError(
          errors,
          'cloudProvider',
          `Cloud provider must be one of: ${CLOUD_PROVIDERS.join(', ')}.`
        );
      }
    }

    // environment — optional, must be valid enum
    if (environment !== undefined && environment !== null) {
      if (!PROJECT_ENVIRONMENTS.includes(environment)) {
        addError(
          errors,
          'environment',
          `Environment must be one of: ${PROJECT_ENVIRONMENTS.join(', ')}.`
        );
      }
    }

    // aiEnabled — optional, must be boolean if provided
    if (aiEnabled !== undefined && typeof aiEnabled !== 'boolean') {
      addError(errors, 'aiEnabled', 'aiEnabled must be a boolean value.');
    }

    // tags — optional array validation
    validateTags(tags, errors);

    return { isValid: errors.length === 0, errors };
  },
};

// ── Update Project Schema ─────────────────────────────────────────────────────

/**
 * Validates the body of PATCH /api/v1/projects/:id.
 * All fields are optional, but at least one must be provided.
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const updateProjectSchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const EDITABLE_FIELDS = [
      'name',
      'description',
      'repositoryUrl',
      'cloudProvider',
      'environment',
      'status',
      'aiEnabled',
      'tags',
    ];

    const {
      name,
      description,
      repositoryUrl,
      cloudProvider,
      environment,
      status,
      aiEnabled,
      tags,
    } = data;

    // At least one field must be provided
    const hasAtLeastOne = EDITABLE_FIELDS.some((f) => data[f] !== undefined);
    if (!hasAtLeastOne) {
      addError(errors, 'body', 'At least one editable field must be provided for an update.');
    }

    // name — optional but validated if present
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        addError(errors, 'name', 'Project name must be a non-empty string.');
      } else if (name.trim().length < 2) {
        addError(errors, 'name', 'Project name must be at least 2 characters.');
      } else if (name.trim().length > 100) {
        addError(errors, 'name', 'Project name must not exceed 100 characters.');
      }
    }

    // description
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        addError(errors, 'description', 'Description must be a string.');
      } else if (description.trim().length > 500) {
        addError(errors, 'description', 'Description must not exceed 500 characters.');
      }
    }

    // repositoryUrl
    if (repositoryUrl !== undefined && repositoryUrl !== null && repositoryUrl !== '') {
      if (typeof repositoryUrl !== 'string' || !isValidUrl(repositoryUrl.trim())) {
        addError(errors, 'repositoryUrl', 'Repository URL must be a valid HTTP/HTTPS URL.');
      }
    }

    // cloudProvider
    if (cloudProvider !== undefined && cloudProvider !== null) {
      if (!CLOUD_PROVIDERS.includes(cloudProvider)) {
        addError(
          errors,
          'cloudProvider',
          `Cloud provider must be one of: ${CLOUD_PROVIDERS.join(', ')}.`
        );
      }
    }

    // environment
    if (environment !== undefined && environment !== null) {
      if (!PROJECT_ENVIRONMENTS.includes(environment)) {
        addError(
          errors,
          'environment',
          `Environment must be one of: ${PROJECT_ENVIRONMENTS.join(', ')}.`
        );
      }
    }

    // status
    if (status !== undefined && status !== null) {
      if (!PROJECT_STATUSES.includes(status)) {
        addError(errors, 'status', `Status must be one of: ${PROJECT_STATUSES.join(', ')}.`);
      }
    }

    // aiEnabled
    if (aiEnabled !== undefined && typeof aiEnabled !== 'boolean') {
      addError(errors, 'aiEnabled', 'aiEnabled must be a boolean value.');
    }

    // tags
    validateTags(tags, errors);

    return { isValid: errors.length === 0, errors };
  },
};

// ── Assign Member Schema ──────────────────────────────────────────────────────

/**
 * Validates the body of POST /api/v1/projects/:id/members.
 * Required: userId (valid MongoDB ObjectId)
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const assignMemberSchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const { userId } = data;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      addError(errors, 'userId', 'userId is required.');
    } else if (!isValidObjectId(userId.trim())) {
      addError(errors, 'userId', 'userId must be a valid MongoDB ObjectId.');
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Project Query Schema ──────────────────────────────────────────────────────

/**
 * Validates query parameters for GET /api/v1/projects.
 * All params are optional.
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const projectQuerySchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      cloudProvider,
      environment,
      owner,
      createdAfter,
      createdBefore,
    } = data;

    const VALID_SORT_BY = ['createdAt', 'updatedAt', 'name', 'status'];
    const VALID_SORT_ORDER = ['asc', 'desc'];

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

    // status
    if (status !== undefined && !PROJECT_STATUSES.includes(status)) {
      addError(errors, 'status', `status filter must be one of: ${PROJECT_STATUSES.join(', ')}.`);
    }

    // cloudProvider
    if (cloudProvider !== undefined && !CLOUD_PROVIDERS.includes(cloudProvider)) {
      addError(
        errors,
        'cloudProvider',
        `cloudProvider filter must be one of: ${CLOUD_PROVIDERS.join(', ')}.`
      );
    }

    // environment
    if (environment !== undefined && !PROJECT_ENVIRONMENTS.includes(environment)) {
      addError(
        errors,
        'environment',
        `environment filter must be one of: ${PROJECT_ENVIRONMENTS.join(', ')}.`
      );
    }

    // owner — must be a valid ObjectId if provided
    if (owner !== undefined && owner !== null && owner !== '') {
      if (!isValidObjectId(String(owner).trim())) {
        addError(errors, 'owner', 'owner filter must be a valid MongoDB ObjectId.');
      }
    }

    // createdAfter / createdBefore — must be valid dates if provided
    if (createdAfter !== undefined && createdAfter !== null) {
      if (isNaN(new Date(createdAfter).getTime())) {
        addError(errors, 'createdAfter', 'createdAfter must be a valid ISO date string.');
      }
    }

    if (createdBefore !== undefined && createdBefore !== null) {
      if (isNaN(new Date(createdBefore).getTime())) {
        addError(errors, 'createdBefore', 'createdBefore must be a valid ISO date string.');
      }
    }

    return { isValid: errors.length === 0, errors };
  },
};
