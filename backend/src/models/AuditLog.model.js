/**
 * @fileoverview AuditLog Mongoose model.
 *
 * Provides an immutable append-only audit trail for all significant user actions.
 * Design decisions:
 *   - No updatedAt timestamp — records are never modified after creation.
 *   - No soft delete — audit logs must be retained for compliance.
 *   - The `metadata` field is schema-flexible (Mixed) to capture action-specific context.
 *   - High-cardinality indexes are kept narrow to minimize write amplification.
 */

import mongoose from 'mongoose';

// ── Enums ─────────────────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'soft_delete',
  'restore',
  'login',
  'logout',
  'login_failed',
  'password_change',
  'role_change',
  'invite',
  'export',
  'import',
];

const AUDIT_RESOURCES = [
  'user',
  'project',
  'monitoring',
  'alert',
  'ai_analysis',
  'notification',
  'audit_log',
];

// ── Schema ────────────────────────────────────────────────────────────────────

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for an audit log.'],
      index: true,
    },

    action: {
      type: String,
      required: [true, 'Audit action is required.'],
      enum: {
        values: AUDIT_ACTIONS,
        message: `Action must be one of: ${AUDIT_ACTIONS.join(', ')}.`,
      },
      index: true,
    },

    resource: {
      type: String,
      required: [true, 'Resource type is required.'],
      enum: {
        values: AUDIT_RESOURCES,
        message: `Resource must be one of: ${AUDIT_RESOURCES.join(', ')}.`,
      },
      index: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: [45, 'IP address must not exceed 45 characters (IPv6 max).'],
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User-Agent must not exceed 500 characters.'],
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    // Append-only: only createdAt, never updatedAt
    timestamps: { createdAt: true, updatedAt: false },
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

// ── Indexes ───────────────────────────────────────────────────────────────────

// Compliance queries: all actions by a user, ordered by time
auditLogSchema.index({ user: 1, action: 1, createdAt: -1 });
// Resource-level audit trail
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
// Time-based security reviews
auditLogSchema.index({ createdAt: -1 });

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Creates a new audit log entry. Use this factory instead of `new AuditLog()`
 * to ensure consistent field population.
 *
 * @param {object} params
 * @param {mongoose.Types.ObjectId|string} params.userId
 * @param {string} params.action
 * @param {string} params.resource
 * @param {mongoose.Types.ObjectId|string|null} [params.resourceId]
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @param {object|null} [params.metadata]
 * @returns {Promise<import('mongoose').Document>}
 */
auditLogSchema.statics.logAction = function ({
  userId,
  action,
  resource,
  resourceId = null,
  ipAddress = null,
  userAgent = null,
  metadata = null,
}) {
  return this.create({
    user: userId,
    action,
    resource,
    resourceId,
    ipAddress,
    userAgent,
    metadata,
  });
};

/**
 * Returns paginated audit logs for a specific user.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @param {number} [limit=50]
 * @param {number} [skip=0]
 * @returns {Promise<import('mongoose').Document[]>}
 */
auditLogSchema.statics.findByUser = function (userId, limit = 50, skip = 0) {
  return this.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
};

/**
 * Returns audit logs for a specific resource instance.
 *
 * @param {string} resource
 * @param {mongoose.Types.ObjectId|string} resourceId
 * @returns {Promise<import('mongoose').Document[]>}
 */
auditLogSchema.statics.findByResource = function (resource, resourceId) {
  return this.find({ resource, resourceId }).sort({ createdAt: -1 });
};

/**
 * Returns audit logs filtered by action type within an optional time range.
 *
 * @param {string} action
 * @param {object} [options]
 * @param {Date} [options.from]
 * @param {Date} [options.to]
 * @param {number} [options.limit=100]
 * @returns {Promise<import('mongoose').Document[]>}
 */
auditLogSchema.statics.findByAction = function (action, { from, to, limit = 100 } = {}) {
  const filter = { action };
  if (from || to) {
    filter.createdAt = {};
    if (from) {
      filter.createdAt.$gte = from;
    }
    if (to) {
      filter.createdAt.$lte = to;
    }
  }
  return this.find(filter).sort({ createdAt: -1 }).limit(limit);
};

// ── Model Export ──────────────────────────────────────────────────────────────

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export { AuditLog, AUDIT_ACTIONS, AUDIT_RESOURCES };
