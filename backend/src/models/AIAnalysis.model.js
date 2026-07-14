/**
 * @fileoverview AIAnalysis Mongoose model.
 *
 * Stores AI-generated analysis results produced for a DevWatch project.
 * Each document represents one AI inference call, capturing:
 *   - The input prompt sent to the model
 *   - The raw model response
 *   - Structured recommendations extracted from the response
 *   - Risk and confidence scoring
 *   - Model metadata (name, tokens used, execution time)
 *
 * Does NOT apply soft delete — AI analysis records are immutable audit artifacts.
 * Deletion is managed via data-retention policies at the repository/service layer.
 */

import mongoose from 'mongoose';

// ── Sub-schema: Recommendation ────────────────────────────────────────────────

const recommendationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Recommendation title is required.'],
      trim: true,
      maxlength: [200, 'Recommendation title must not exceed 200 characters.'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Recommendation description must not exceed 1000 characters.'],
      default: null,
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: 'Recommendation priority must be one of: low, medium, high, critical.',
      },
      default: 'medium',
    },
    category: {
      type: String,
      trim: true,
      maxlength: [50, 'Category must not exceed 50 characters.'],
      default: null,
    },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const aiAnalysisSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required for an AI analysis record.'],
      index: true,
    },

    prompt: {
      type: String,
      required: [true, 'AI prompt is required.'],
      trim: true,
      maxlength: [10000, 'Prompt must not exceed 10,000 characters.'],
    },

    response: {
      type: String,
      required: [true, 'AI response is required.'],
      maxlength: [50000, 'Response must not exceed 50,000 characters.'],
    },

    recommendations: {
      type: [recommendationSchema],
      default: [],
    },

    riskScore: {
      type: Number,
      min: [0, 'Risk score cannot be negative.'],
      max: [100, 'Risk score cannot exceed 100.'],
      default: null,
    },

    confidenceScore: {
      type: Number,
      min: [0, 'Confidence score cannot be negative.'],
      max: [100, 'Confidence score cannot exceed 100.'],
      default: null,
    },

    modelName: {
      type: String,
      required: [true, 'Model name is required.'],
      trim: true,
      maxlength: [100, 'Model name must not exceed 100 characters.'],
    },

    tokensUsed: {
      type: Number,
      min: [0, 'Token count cannot be negative.'],
      default: null,
    },

    executionTime: {
      type: Number,
      min: [0, 'Execution time cannot be negative.'],
      default: null,
    },

    generatedAt: {
      type: Date,
      required: [true, 'Generation timestamp is required.'],
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: false, // generatedAt is the authoritative timestamp
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

// Primary access: latest analysis per project
aiAnalysisSchema.index({ project: 1, generatedAt: -1 });
// Risk dashboard: high-risk analyses
aiAnalysisSchema.index({ riskScore: -1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Returns the total number of recommendations.
 *
 * @returns {number}
 */
aiAnalysisSchema.virtual('recommendationCount').get(function () {
  return this.recommendations?.length ?? 0;
});

/**
 * Classifies the risk level based on the riskScore value.
 *
 * @returns {'low'|'medium'|'high'|'critical'|'unknown'}
 */
aiAnalysisSchema.virtual('riskLevel').get(function () {
  if (this.riskScore === null) {
    return 'unknown';
  }
  if (this.riskScore >= 80) {
    return 'critical';
  }
  if (this.riskScore >= 60) {
    return 'high';
  }
  if (this.riskScore >= 40) {
    return 'medium';
  }
  return 'low';
});

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Returns the most recent AI analysis for a project.
 *
 * @param {mongoose.Types.ObjectId|string} projectId
 * @returns {Promise<import('mongoose').Document|null>}
 */
aiAnalysisSchema.statics.findLatestByProject = function (projectId) {
  return this.findOne({ project: projectId }).sort({ generatedAt: -1 });
};

/**
 * Returns all analyses with a risk score at or above the given threshold.
 *
 * @param {number} [minScore=70]
 * @returns {Promise<import('mongoose').Document[]>}
 */
aiAnalysisSchema.statics.findHighRisk = function (minScore = 70) {
  return this.find({ riskScore: { $gte: minScore } }).sort({ riskScore: -1, generatedAt: -1 });
};

/**
 * Returns aggregate token and execution statistics for a project.
 *
 * @param {mongoose.Types.ObjectId|string} projectId
 * @returns {Promise<object|null>}
 */
aiAnalysisSchema.statics.getUsageStats = function (projectId) {
  return this.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId) } },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: '$tokensUsed' },
        totalExecutionTime: { $sum: '$executionTime' },
        avgRiskScore: { $avg: '$riskScore' },
        avgConfidenceScore: { $avg: '$confidenceScore' },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);
};

// ── Model Export ──────────────────────────────────────────────────────────────

const AIAnalysis = mongoose.model('AIAnalysis', aiAnalysisSchema);

export { AIAnalysis };
