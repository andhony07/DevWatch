/**
 * @fileoverview Alert Mongoose model.
 *
 * Represents a triggered monitoring alert for a DevWatch project.
 * Responsibilities:
 *   - Captures alert metadata: title, description, severity, source, status.
 *   - Tracks lifecycle timestamps (triggeredAt, resolvedAt).
 *   - Supports assignment to a User for incident management.
 *   - References Project and User with ObjectId foreign keys.
 *   - Applies soft-delete support.
 */

import mongoose from 'mongoose';
import { softDeletePlugin } from './plugins/softDelete.plugin.js';

// ── Enums ─────────────────────────────────────────────────────────────────────

const ALERT_SEVERITIES = ['info', 'warning', 'error', 'critical'];
const ALERT_STATUSES = ['open', 'acknowledged', 'resolved', 'suppressed'];
const ALERT_SOURCES = [
  'cpu',
  'memory',
  'disk',
  'network',
  'response_time',
  'availability',
  'error_rate',
  'custom',
];

// ── Schema ────────────────────────────────────────────────────────────────────

const alertSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required for an alert.'],
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Alert title is required.'],
      trim: true,
      maxlength: [200, 'Alert title must not exceed 200 characters.'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Alert description must not exceed 1000 characters.'],
      default: null,
    },

    severity: {
      type: String,
      required: [true, 'Alert severity is required.'],
      enum: {
        values: ALERT_SEVERITIES,
        message: `Severity must be one of: ${ALERT_SEVERITIES.join(', ')}.`,
      },
      index: true,
    },

    source: {
      type: String,
      required: [true, 'Alert source is required.'],
      enum: {
        values: ALERT_SOURCES,
        message: `Source must be one of: ${ALERT_SOURCES.join(', ')}.`,
      },
    },

    status: {
      type: String,
      enum: {
        values: ALERT_STATUSES,
        message: `Status must be one of: ${ALERT_STATUSES.join(', ')}.`,
      },
      default: 'open',
      index: true,
    },

    triggeredAt: {
      type: Date,
      required: [true, 'Trigger timestamp is required.'],
      default: () => new Date(),
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
alertSchema.plugin(softDeletePlugin);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary dashboard query: open critical alerts per project
alertSchema.index({ project: 1, status: 1, severity: 1 });
// Time-ordered alert feed
alertSchema.index({ triggeredAt: -1 });
// Assignment queue
alertSchema.index({ assignedTo: 1, status: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns the duration in milliseconds from trigger to resolution.
 * Returns null if the alert has not yet been resolved.
 *
 * @returns {number|null}
 */
alertSchema.virtual('resolutionTimeMs').get(function () {
  if (!this.resolvedAt || !this.triggeredAt) {
    return null;
  }
  return this.resolvedAt.getTime() - this.triggeredAt.getTime();
});

/**
 * Returns true if the alert is currently open or acknowledged.
 *
 * @returns {boolean}
 */
alertSchema.virtual('isActive').get(function () {
  return this.status === 'open' || this.status === 'acknowledged';
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Marks the alert as resolved with the current timestamp.
 *
 * @param {mongoose.Types.ObjectId|string} [resolvedBy] - User who resolved the alert
 * @returns {Promise<this>}
 */
alertSchema.methods.resolve = function (resolvedBy = null) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  if (resolvedBy) {
    this.updatedBy = resolvedBy;
  }
  return this.save();
};

/**
 * Assigns the alert to a specific user for investigation.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<this>}
 */
alertSchema.methods.assign = function (userId) {
  this.assignedTo = userId;
  this.status = 'acknowledged';
  return this.save();
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Returns all open alerts for a project, sorted by severity then trigger time.
 *
 * @param {mongoose.Types.ObjectId|string} projectId
 * @returns {Promise<import('mongoose').Document[]>}
 */
alertSchema.statics.findOpenByProject = function (projectId) {
  const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
  return this.find({ project: projectId, status: { $in: ['open', 'acknowledged'] } })
    .sort({ triggeredAt: -1 })
    .then((alerts) =>
      alerts.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))
    );
};

/**
 * Returns critical alerts that have been open for longer than the given threshold.
 *
 * @param {number} [thresholdMs=3600000] - Age threshold in ms (default 1 hour)
 * @returns {Promise<import('mongoose').Document[]>}
 */
alertSchema.statics.findStaleCritical = function (thresholdMs = 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - thresholdMs);
  return this.find({ severity: 'critical', status: 'open', triggeredAt: { $lt: cutoff } }).sort({
    triggeredAt: 1,
  });
};

// ── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Chainable query helper to filter only open/acknowledged alerts.
 *
 * @example
 * await Alert.find({ project: id }).open()
 */
alertSchema.query.open = function () {
  return this.where({ status: { $in: ['open', 'acknowledged'] } });
};

/**
 * Chainable query helper to filter by a specific severity level.
 *
 * @param {string} level
 * @example
 * await Alert.find().bySeverity('critical')
 */
alertSchema.query.bySeverity = function (level) {
  return this.where({ severity: level });
};

// ── Model Export ──────────────────────────────────────────────────────────────

const Alert = mongoose.model('Alert', alertSchema);

export { Alert, ALERT_SEVERITIES, ALERT_STATUSES, ALERT_SOURCES };
