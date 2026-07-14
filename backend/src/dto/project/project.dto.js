/**
 * @fileoverview Project DTOs (Data Transfer Objects).
 *
 * DTOs are immutable value objects that:
 *   1. Accept raw request bodies / query strings via a static `fromRequest()` factory.
 *   2. Expose only the fields each operation needs.
 *   3. Provide a serialization method that shapes the Mongoose document into
 *      a clean API response object (`ProjectResponseDTO`).
 *
 * DTOs do NOT perform validation — that responsibility belongs to the
 * validator schemas in `src/validators/project.validator.js`.
 */

import { APP_CONSTANTS } from '../../constants/appConstants.js';

const { PAGINATION } = APP_CONSTANTS;

// ── CreateProjectDTO ──────────────────────────────────────────────────────────

/**
 * @class CreateProjectDTO
 * Carries project creation input from the HTTP layer into the service layer.
 */
export class CreateProjectDTO {
  /**
   * @param {object} params
   * @param {string}   params.name
   * @param {string}   [params.description]
   * @param {string}   [params.repositoryUrl]
   * @param {string}   [params.cloudProvider]
   * @param {string}   [params.environment]
   * @param {boolean}  [params.aiEnabled]
   * @param {string[]} [params.tags]
   */
  constructor({ name, description, repositoryUrl, cloudProvider, environment, aiEnabled, tags }) {
    this.name = name?.trim();
    this.description = description?.trim() ?? null;
    this.repositoryUrl = repositoryUrl?.trim() ?? null;
    this.cloudProvider = cloudProvider ?? 'other';
    this.environment = environment ?? 'development';
    this.aiEnabled = typeof aiEnabled === 'boolean' ? aiEnabled : false;
    this.tags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [];
  }

  /**
   * Factory — builds a CreateProjectDTO from a raw Express request body.
   *
   * @param {object} body - req.body
   * @returns {CreateProjectDTO}
   */
  static fromRequest(body) {
    return new CreateProjectDTO(body);
  }

  /**
   * Returns a plain object safe for logging / persistence.
   *
   * @returns {object}
   */
  toSafeObject() {
    return {
      name: this.name,
      description: this.description,
      repositoryUrl: this.repositoryUrl,
      cloudProvider: this.cloudProvider,
      environment: this.environment,
      aiEnabled: this.aiEnabled,
      tags: this.tags,
    };
  }
}

// ── UpdateProjectDTO ──────────────────────────────────────────────────────────

/**
 * @class UpdateProjectDTO
 * Carries partial project update fields; only defined fields are applied.
 */
export class UpdateProjectDTO {
  /**
   * @param {object} params - All fields are optional
   * @param {string}   [params.name]
   * @param {string}   [params.description]
   * @param {string}   [params.repositoryUrl]
   * @param {string}   [params.cloudProvider]
   * @param {string}   [params.environment]
   * @param {string}   [params.status]
   * @param {boolean}  [params.aiEnabled]
   * @param {string[]} [params.tags]
   */
  constructor({
    name,
    description,
    repositoryUrl,
    cloudProvider,
    environment,
    status,
    aiEnabled,
    tags,
  } = {}) {
    if (name !== undefined) {
      this.name = name.trim();
    }
    if (description !== undefined) {
      this.description = description?.trim() ?? null;
    }
    if (repositoryUrl !== undefined) {
      this.repositoryUrl = repositoryUrl?.trim() ?? null;
    }
    if (cloudProvider !== undefined) {
      this.cloudProvider = cloudProvider;
    }
    if (environment !== undefined) {
      this.environment = environment;
    }
    if (status !== undefined) {
      this.status = status;
    }
    if (aiEnabled !== undefined) {
      this.aiEnabled = Boolean(aiEnabled);
    }
    if (tags !== undefined) {
      this.tags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [];
    }
  }

  /**
   * @param {object} body - req.body
   * @returns {UpdateProjectDTO}
   */
  static fromRequest(body) {
    return new UpdateProjectDTO(body);
  }

  /**
   * Returns only the fields that were explicitly set (for partial $set updates).
   *
   * @returns {object}
   */
  toUpdatePayload() {
    const payload = {};
    const editableFields = [
      'name',
      'description',
      'repositoryUrl',
      'cloudProvider',
      'environment',
      'status',
      'aiEnabled',
      'tags',
    ];
    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(this, field)) {
        payload[field] = this[field];
      }
    }
    return payload;
  }
}

// ── AssignMemberDTO ───────────────────────────────────────────────────────────

/**
 * @class AssignMemberDTO
 * Carries a user ID for team member assignment/removal.
 */
export class AssignMemberDTO {
  /**
   * @param {object} params
   * @param {string} params.userId
   */
  constructor({ userId }) {
    this.userId = userId?.trim();
  }

  /**
   * @param {object} body - req.body
   * @returns {AssignMemberDTO}
   */
  static fromRequest(body) {
    return new AssignMemberDTO(body);
  }

  /** @returns {{ userId: string }} */
  toSafeObject() {
    return { userId: this.userId };
  }
}

// ── ProjectQueryDTO ───────────────────────────────────────────────────────────

/**
 * @class ProjectQueryDTO
 * Carries pagination, sorting, search, and filter options from the query string.
 */
export class ProjectQueryDTO {
  /**
   * @param {object} params
   * @param {number|string} [params.page=1]
   * @param {number|string} [params.limit=20]
   * @param {string} [params.sortBy='createdAt']
   * @param {string} [params.sortOrder='desc']
   * @param {string} [params.search]
   * @param {string} [params.status]
   * @param {string} [params.cloudProvider]
   * @param {string} [params.environment]
   * @param {string} [params.owner]
   * @param {string} [params.createdAfter]
   * @param {string} [params.createdBefore]
   */
  constructor({
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    status,
    cloudProvider,
    environment,
    owner,
    createdAfter,
    createdBefore,
  } = {}) {
    this.page = Math.max(1, parseInt(page, 10) || PAGINATION.DEFAULT_PAGE);
    this.limit = Math.min(
      Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT),
      PAGINATION.MAX_LIMIT
    );
    this.sortBy = ['createdAt', 'updatedAt', 'name', 'status'].includes(sortBy)
      ? sortBy
      : 'createdAt';
    this.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Search
    this.search = typeof search === 'string' && search.trim() ? search.trim() : null;

    // Filters
    this.status = status ?? null;
    this.cloudProvider = cloudProvider ?? null;
    this.environment = environment ?? null;
    this.owner = owner ?? null;
    this.createdAfter = createdAfter ? new Date(createdAfter) : null;
    this.createdBefore = createdBefore ? new Date(createdBefore) : null;
  }

  /**
   * @param {object} query - req.query
   * @returns {ProjectQueryDTO}
   */
  static fromRequest(query) {
    return new ProjectQueryDTO(query);
  }

  /**
   * Returns the Mongoose sort string (e.g. '-createdAt' or 'name').
   *
   * @returns {string}
   */
  get sortString() {
    return `${this.sortOrder === 'desc' ? '-' : ''}${this.sortBy}`;
  }
}

// ── ProjectResponseDTO ────────────────────────────────────────────────────────

/**
 * @class ProjectResponseDTO
 * Serializes a Mongoose Project document into a clean, stable API response shape.
 * Prevents accidental leakage of internal fields and ensures forward compatibility.
 */
export class ProjectResponseDTO {
  /**
   * @param {import('mongoose').Document} doc - A Project Mongoose document
   */
  constructor(doc) {
    const plain = doc.toJSON ? doc.toJSON() : doc;

    this.id = plain.id ?? plain._id;
    this.name = plain.name;
    this.description = plain.description;
    this.owner = plain.owner;
    this.teamMembers = plain.teamMembers ?? [];
    this.repositoryUrl = plain.repositoryUrl;
    this.cloudProvider = plain.cloudProvider;
    this.environment = plain.environment;
    this.status = plain.status;
    this.aiEnabled = plain.aiEnabled;
    this.tags = plain.tags ?? [];
    this.teamSize = plain.teamSize ?? plain.teamMembers?.length ?? 0;
    this.isActive = plain.isActive ?? (plain.status === 'active' && !plain.isDeleted);
    this.isDeleted = plain.isDeleted ?? false;
    this.createdBy = plain.createdBy;
    this.updatedBy = plain.updatedBy;
    this.createdAt = plain.createdAt;
    this.updatedAt = plain.updatedAt;
  }

  /**
   * Builds a ProjectResponseDTO from a Mongoose document.
   *
   * @param {import('mongoose').Document} doc
   * @returns {ProjectResponseDTO}
   */
  static fromDocument(doc) {
    return new ProjectResponseDTO(doc);
  }

  /**
   * Builds an array of ProjectResponseDTO objects from an array of documents.
   *
   * @param {import('mongoose').Document[]} docs
   * @returns {ProjectResponseDTO[]}
   */
  static fromDocuments(docs) {
    return docs.map((doc) => new ProjectResponseDTO(doc));
  }
}
