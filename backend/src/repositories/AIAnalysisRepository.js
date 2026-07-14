/**
 * @fileoverview AIAnalysisRepository — data-access layer for AIAnalysis documents.
 *
 * Extends BaseRepository with AI-analysis–specific query methods:
 *   - Latest analysis retrieval per project
 *   - Risk-score–based filtering
 *   - Usage statistics aggregation
 */

import mongoose from 'mongoose';
import { BaseRepository } from './BaseRepository.js';
import { AIAnalysis } from '../models/index.js';

export class AIAnalysisRepository extends BaseRepository {
  constructor() {
    super(AIAnalysis);
  }

  // ── Project-Scoped Queries ────────────────────────────────────────────────────

  /**
   * Returns paginated AI analysis records for a project, newest first.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findByProject(projectId, options = {}) {
    return this.paginate({ project: projectId }, { sort: '-generatedAt', ...options });
  }

  /**
   * Returns the most recently generated AI analysis for a project.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  findLatestByProject(projectId) {
    return this.findOne({ project: projectId }, { sort: '-generatedAt' });
  }

  // ── Risk Queries ──────────────────────────────────────────────────────────────

  /**
   * Returns paginated analyses with a risk score at or above the given threshold.
   *
   * @param {number} [minScore=70]
   * @param {object} [options]
   * @returns {Promise<object>} Paginated result
   */
  findHighRisk(minScore = 70, options = {}) {
    return this.paginate(
      { riskScore: { $gte: minScore } },
      { sort: '-riskScore -generatedAt', ...options }
    );
  }

  // ── Statistics ────────────────────────────────────────────────────────────────

  /**
   * Returns aggregate usage statistics (tokens, execution time, risk, confidence)
   * for all analyses associated with a project.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @returns {Promise<object|null>}
   */
  async getUsageStats(projectId) {
    const [result] = await this.model.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$tokensUsed' },
          totalExecutionTimeMs: { $sum: '$executionTime' },
          avgRiskScore: { $avg: '$riskScore' },
          avgConfidenceScore: { $avg: '$confidenceScore' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return result ?? null;
  }

  /**
   * Returns the model names used across all analyses for a project with their counts.
   *
   * @param {string|mongoose.Types.ObjectId} projectId
   * @returns {Promise<Array<{model: string, count: number}>>}
   */
  getModelUsageBreakdown(projectId) {
    return this.model.aggregate([
      { $match: { project: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$modelName', count: { $sum: 1 } } },
      { $project: { _id: 0, model: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);
  }
}
