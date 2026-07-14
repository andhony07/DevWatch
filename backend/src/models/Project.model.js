/**
 * @fileoverview Project Mongoose model.
 *
 * Represents a monitored project or service within DevWatch.
 * Responsibilities:
 *   - Tracks ownership, team membership, repository details, cloud provider, and environment.
 *   - Maintains a tags array for flexible categorization.
 *   - References User for owner and teamMembers.
 *   - Applies soft-delete support.
 */

import mongoose from 'mongoose';
import { softDeletePlugin } from './plugins/softDelete.plugin.js';

// ── Enums ─────────────────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = ['aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'other'];
const PROJECT_ENVIRONMENTS = ['development', 'staging', 'production', 'testing'];
const PROJECT_STATUSES = ['active', 'inactive', 'archived'];

// ── Schema ────────────────────────────────────────────────────────────────────

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required.'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters.'],
      maxlength: [100, 'Project name must not exceed 100 characters.'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters.'],
      default: null,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project owner is required.'],
      index: true,
    },

    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    repositoryUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Repository URL must be a valid HTTP/HTTPS URL.'],
      default: null,
    },

    cloudProvider: {
      type: String,
      enum: {
        values: CLOUD_PROVIDERS,
        message: `Cloud provider must be one of: ${CLOUD_PROVIDERS.join(', ')}.`,
      },
      default: 'other',
    },

    environment: {
      type: String,
      enum: {
        values: PROJECT_ENVIRONMENTS,
        message: `Environment must be one of: ${PROJECT_ENVIRONMENTS.join(', ')}.`,
      },
      default: 'development',
    },

    status: {
      type: String,
      enum: {
        values: PROJECT_STATUSES,
        message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}.`,
      },
      default: 'active',
    },

    aiEnabled: {
      type: Boolean,
      default: false,
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator(tags) {
          return tags.length <= 20;
        },
        message: 'A project cannot have more than 20 tags.',
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

// ── Soft Delete ───────────────────────────────────────────────────────────────
projectSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ teamMembers: 1 });
projectSchema.index({ cloudProvider: 1, environment: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ createdAt: -1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns the total number of team members on the project.
 *
 * @returns {number}
 */
projectSchema.virtual('teamSize').get(function () {
  return this.teamMembers?.length ?? 0;
});

/**
 * Returns true if the project is actively monitored.
 *
 * @returns {boolean}
 */
projectSchema.virtual('isActive').get(function () {
  return this.status === 'active' && !this.isDeleted;
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Adds a user to the project team if they are not already a member.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<this>}
 */
projectSchema.methods.addMember = async function (userId) {
  const id = new mongoose.Types.ObjectId(userId);
  const alreadyMember = this.teamMembers.some((m) => m.equals(id));
  if (!alreadyMember) {
    this.teamMembers.push(id);
    await this.save();
  }
  return this;
};

/**
 * Removes a user from the project team.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<this>}
 */
projectSchema.methods.removeMember = function (userId) {
  const id = new mongoose.Types.ObjectId(userId);
  this.teamMembers = this.teamMembers.filter((m) => !m.equals(id));
  return this.save();
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Returns all active projects owned by a specific user.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<import('mongoose').Document[]>}
 */
projectSchema.statics.findByOwner = function (userId) {
  return this.find({ owner: userId, status: 'active' }).sort({ createdAt: -1 });
};

/**
 * Returns all projects where the user is a team member.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<import('mongoose').Document[]>}
 */
projectSchema.statics.findByMember = function (userId) {
  return this.find({ teamMembers: userId, status: 'active' }).sort({ createdAt: -1 });
};

// ── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Chainable query helper to filter only active projects.
 *
 * @example
 * await Project.find().active()
 */
projectSchema.query.active = function () {
  return this.where({ status: 'active' });
};

/**
 * Chainable query helper to filter only AI-enabled projects.
 *
 * @example
 * await Project.find().aiEnabled()
 */
projectSchema.query.aiEnabled = function () {
  return this.where({ aiEnabled: true });
};

// ── Model Export ──────────────────────────────────────────────────────────────

const Project = mongoose.model('Project', projectSchema);

export { Project, CLOUD_PROVIDERS, PROJECT_ENVIRONMENTS, PROJECT_STATUSES };
