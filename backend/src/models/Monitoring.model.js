/**
 * @fileoverview Monitoring Mongoose model.
 *
 * Stores point-in-time infrastructure metric snapshots for a monitored project.
 * Designed for time-series usage patterns:
 *   - High write frequency (one document per collection interval)
 *   - Range queries over (project, collectedAt) are the primary access pattern
 *   - All metric fields are optional to support partial metric collection
 *
 * Does NOT apply soft delete — metric records are immutable once written
 * and are removed only via TTL or explicit data-retention policies.
 */

import mongoose from 'mongoose';

// ── Sub-schema: Network Usage ─────────────────────────────────────────────────

const networkUsageSchema = new mongoose.Schema(
  {
    inbound: {
      type: Number,
      min: [0, 'Inbound network usage cannot be negative.'],
      default: null,
    },
    outbound: {
      type: Number,
      min: [0, 'Outbound network usage cannot be negative.'],
      default: null,
    },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const monitoringSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required for a monitoring record.'],
      index: true,
    },

    cpuUsage: {
      type: Number,
      min: [0, 'CPU usage cannot be negative.'],
      max: [100, 'CPU usage cannot exceed 100%.'],
      default: null,
    },

    memoryUsage: {
      type: Number,
      min: [0, 'Memory usage cannot be negative.'],
      max: [100, 'Memory usage cannot exceed 100%.'],
      default: null,
    },

    diskUsage: {
      type: Number,
      min: [0, 'Disk usage cannot be negative.'],
      max: [100, 'Disk usage cannot exceed 100%.'],
      default: null,
    },

    networkUsage: {
      type: networkUsageSchema,
      default: () => ({}),
    },

    responseTime: {
      type: Number,
      min: [0, 'Response time cannot be negative.'],
      default: null,
    },

    availability: {
      type: Number,
      min: [0, 'Availability cannot be negative.'],
      max: [100, 'Availability cannot exceed 100%.'],
      default: null,
    },

    errorRate: {
      type: Number,
      min: [0, 'Error rate cannot be negative.'],
      max: [100, 'Error rate cannot exceed 100%.'],
      default: null,
    },

    collectedAt: {
      type: Date,
      required: [true, 'Collection timestamp is required.'],
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: false, // collectedAt is the authoritative timestamp for this model
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

// Primary access pattern: range queries per project over time
monitoringSchema.index({ project: 1, collectedAt: -1 });
// Used for dashboard aggregations
monitoringSchema.index({ collectedAt: -1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns a simple health classification based on key metrics.
 *
 * @returns {'healthy'|'degraded'|'critical'|'unknown'}
 */
monitoringSchema.virtual('healthStatus').get(function () {
  const { cpuUsage, memoryUsage, availability, errorRate } = this;

  if (cpuUsage === null && memoryUsage === null) {
    return 'unknown';
  }

  const isCritical =
    cpuUsage > 90 ||
    memoryUsage > 90 ||
    (availability !== null && availability < 90) ||
    errorRate > 10;

  const isDegraded =
    cpuUsage > 70 ||
    memoryUsage > 80 ||
    (availability !== null && availability < 99) ||
    errorRate > 1;

  if (isCritical) {
    return 'critical';
  }
  if (isDegraded) {
    return 'degraded';
  }
  return 'healthy';
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Returns the most recent monitoring record for a given project.
 *
 * @param {mongoose.Types.ObjectId|string} projectId
 * @returns {Promise<import('mongoose').Document|null>}
 */
monitoringSchema.statics.findLatestByProject = function (projectId) {
  return this.findOne({ project: projectId }).sort({ collectedAt: -1 });
};

/**
 * Returns monitoring records for a project within a time range.
 *
 * @param {mongoose.Types.ObjectId|string} projectId
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<import('mongoose').Document[]>}
 */
monitoringSchema.statics.findInRange = function (projectId, from, to) {
  return this.find({
    project: projectId,
    collectedAt: { $gte: from, $lte: to },
  }).sort({ collectedAt: 1 });
};

// ── Model Export ──────────────────────────────────────────────────────────────

const Monitoring = mongoose.model('Monitoring', monitoringSchema);

export { Monitoring };
