/**
 * @fileoverview Monitoring Analytics Utility — Phase 6.
 *
 * Pure, stateless functions that compute analytics from arrays of numbers
 * or KPI objects returned by MonitoringRepository.calculateKPIs().
 *
 * These functions contain NO database calls and are fully unit-testable
 * in isolation without mocking any dependencies.
 *
 * Exports:
 *   computeMedian(values)
 *   computePercentile(values, p)
 *   computeHealthScore(kpis)
 *   computeUptimePercentage(avgAvailability)
 *   computeDowntimePercentage(avgAvailability)
 *   computeErrorTrend(snapshots)
 *   enrichKPIs(rawKpis)
 */

// ── Statistical Helpers ───────────────────────────────────────────────────────

/**
 * Returns the median of a numeric array.
 * Filters out null/undefined/NaN values before computing.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {number|null} Median value or null if no valid data
 */
export function computeMedian(values) {
  const clean = values.filter((v) => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (clean.length === 0) {
    return null;
  }
  clean.sort((a, b) => a - b);
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return Math.round(((clean[mid - 1] + clean[mid]) / 2) * 100) / 100;
  }
  return clean[mid];
}

/**
 * Returns the p-th percentile of a numeric array using linear interpolation.
 * Filters out null/undefined/NaN values before computing.
 *
 * @param {Array<number|null|undefined>} values
 * @param {number} p - Percentile (0–100), e.g. 95 for p95
 * @returns {number|null} Percentile value or null if no valid data
 */
export function computePercentile(values, p) {
  if (p < 0 || p > 100) {
    throw new RangeError(`Percentile must be between 0 and 100, got: ${p}`);
  }
  const clean = values.filter((v) => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (clean.length === 0) {
    return null;
  }
  clean.sort((a, b) => a - b);

  if (p === 0) {
    return clean[0];
  }
  if (p === 100) {
    return clean[clean.length - 1];
  }

  const index = (p / 100) * (clean.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return clean[lower];
  }

  const fraction = index - lower;
  const result = clean[lower] + fraction * (clean[upper] - clean[lower]);
  return Math.round(result * 100) / 100;
}

// ── Uptime / Downtime ─────────────────────────────────────────────────────────

/**
 * Converts an average availability percentage to an uptime percentage string.
 *
 * @param {number|null} avgAvailability - 0–100
 * @returns {number|null} Rounded uptime percentage (2 decimal places)
 */
export function computeUptimePercentage(avgAvailability) {
  if (avgAvailability === null || avgAvailability === undefined || isNaN(avgAvailability)) {
    return null;
  }
  return Math.round(Math.min(100, Math.max(0, avgAvailability)) * 100) / 100;
}

/**
 * Returns the downtime percentage given an average availability.
 *
 * @param {number|null} avgAvailability - 0–100
 * @returns {number|null} Downtime percentage (2 decimal places)
 */
export function computeDowntimePercentage(avgAvailability) {
  const uptime = computeUptimePercentage(avgAvailability);
  if (uptime === null) {
    return null;
  }
  return Math.round((100 - uptime) * 100) / 100;
}

// ── Error Trend ───────────────────────────────────────────────────────────────

/**
 * Analyzes the error rate trend by comparing the first and second halves of a
 * time-ordered series of snapshots.
 *
 * @param {Array<{errorRate: number|null}>} snapshots - Time-ordered (oldest first)
 * @returns {{ trend: 'improving'|'worsening'|'stable'|'unknown'; delta: number|null; direction: 1|0|-1 }}
 */
export function computeErrorTrend(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) {
    return { trend: 'unknown', delta: null, direction: 0 };
  }

  const rates = snapshots
    .map((s) => s.errorRate)
    .filter((v) => v !== null && v !== undefined && !isNaN(v));

  if (rates.length < 2) {
    return { trend: 'unknown', delta: null, direction: 0 };
  }

  const half = Math.floor(rates.length / 2);
  const firstHalf = rates.slice(0, half);
  const secondHalf = rates.slice(half);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const delta = Math.round((avgSecond - avgFirst) * 100) / 100;
  const threshold = 0.1; // 0.1% change is considered stable

  if (Math.abs(delta) <= threshold) {
    return { trend: 'stable', delta, direction: 0 };
  }

  if (delta < 0) {
    return { trend: 'improving', delta, direction: -1 };
  }

  return { trend: 'worsening', delta, direction: 1 };
}

// ── Health Score ──────────────────────────────────────────────────────────────

/**
 * Computes a composite health score (0–100) from KPI values.
 *
 * Scoring formula:
 *   - CPU score:          100 - avgCpu                  (weight: 0.20)
 *   - Memory score:       100 - avgMemory               (weight: 0.20)
 *   - Availability score: avgAvailability               (weight: 0.35)
 *   - Error-rate score:   100 - (avgErrorRate * 10)     (weight: 0.25)
 *
 * Returns null if no KPI data is available.
 *
 * @param {{
 *   avgCpu?: number|null;
 *   avgMemory?: number|null;
 *   avgAvailability?: number|null;
 *   avgErrorRate?: number|null;
 * }} kpis
 * @returns {number|null} Health score 0–100, or null if insufficient data
 */
export function computeHealthScore(kpis) {
  if (!kpis) {
    return null;
  }

  const { avgCpu, avgMemory, avgAvailability, avgErrorRate } = kpis;

  // Require at least one metric to compute a score
  if (
    (avgCpu === null || avgCpu === undefined) &&
    (avgMemory === null || avgMemory === undefined) &&
    (avgAvailability === null || avgAvailability === undefined) &&
    (avgErrorRate === null || avgErrorRate === undefined)
  ) {
    return null;
  }

  let totalWeight = 0;
  let weightedScore = 0;

  if (avgCpu !== null && avgCpu !== undefined) {
    weightedScore += (100 - Math.min(100, Math.max(0, avgCpu))) * 0.2;
    totalWeight += 0.2;
  }

  if (avgMemory !== null && avgMemory !== undefined) {
    weightedScore += (100 - Math.min(100, Math.max(0, avgMemory))) * 0.2;
    totalWeight += 0.2;
  }

  if (avgAvailability !== null && avgAvailability !== undefined) {
    weightedScore += Math.min(100, Math.max(0, avgAvailability)) * 0.35;
    totalWeight += 0.35;
  }

  if (avgErrorRate !== null && avgErrorRate !== undefined) {
    const errorScore = Math.max(0, 100 - Math.min(100, avgErrorRate * 10));
    weightedScore += errorScore * 0.25;
    totalWeight += 0.25;
  }

  if (totalWeight === 0) {
    return null;
  }

  // Normalize to account for missing metrics
  const normalizedScore = weightedScore / totalWeight;
  return Math.round(Math.min(100, Math.max(0, normalizedScore)) * 100) / 100;
}

// ── KPI Enrichment ────────────────────────────────────────────────────────────

/**
 * Takes raw KPI output from `MonitoringRepository.calculateKPIs()` and enriches
 * it with derived analytics: median response time, percentiles, health score,
 * uptime/downtime, and error trend.
 *
 * @param {object|null} rawKpis  - Result from calculateKPIs()
 * @param {Array}       [snaps]  - Raw snapshot documents for trend analysis
 * @returns {{
 *   averages: object;
 *   peaks: object;
 *   percentiles: object;
 *   uptime: object;
 *   errorTrend: object;
 *   healthScore: number|null;
 *   sampleCount: number;
 * }|null}
 */
export function enrichKPIs(rawKpis, snaps = []) {
  if (!rawKpis) {
    return null;
  }

  const responseTimes = rawKpis.responseTimes ?? [];

  const medianResponseTime = computeMedian(responseTimes);
  const p95ResponseTime = computePercentile(responseTimes, 95);
  const p99ResponseTime = computePercentile(responseTimes, 99);

  const uptimePercentage = computeUptimePercentage(rawKpis.avgAvailability);
  const downtimePercentage = computeDowntimePercentage(rawKpis.avgAvailability);
  const errorTrend = computeErrorTrend(snaps);
  const healthScore = computeHealthScore({
    avgCpu: rawKpis.avgCpu,
    avgMemory: rawKpis.avgMemory,
    avgAvailability: rawKpis.avgAvailability,
    avgErrorRate: rawKpis.avgErrorRate,
  });

  return {
    averages: {
      cpu: rawKpis.avgCpu,
      memory: rawKpis.avgMemory,
      disk: rawKpis.avgDisk,
      networkInbound: rawKpis.avgNetworkInbound,
      networkOutbound: rawKpis.avgNetworkOutbound,
      responseTime: rawKpis.avgResponseTime,
      availability: rawKpis.avgAvailability,
      errorRate: rawKpis.avgErrorRate,
    },
    peaks: {
      cpu: rawKpis.peakCpu,
      memory: rawKpis.peakMemory,
      responseTime: rawKpis.maxResponseTime,
    },
    percentiles: {
      p50ResponseTime: medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
    },
    uptime: {
      uptimePercentage,
      downtimePercentage,
    },
    errorTrend,
    healthScore,
    sampleCount: rawKpis.sampleCount ?? 0,
  };
}
