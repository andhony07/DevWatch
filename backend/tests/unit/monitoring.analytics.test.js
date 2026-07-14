/* eslint-disable no-undef */
/**
 * @fileoverview Unit tests for monitoring analytics utility functions.
 *
 * All functions are pure (no side effects, no DB calls) so no mocking is needed.
 * Tests verify correctness of statistical computations, edge cases, and enrichment.
 *
 * Functions tested:
 *   computeMedian
 *   computePercentile
 *   computeUptimePercentage
 *   computeDowntimePercentage
 *   computeErrorTrend
 *   computeHealthScore
 *   enrichKPIs
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://localhost:27017/devwatch_test';
process.env.JWT_SECRET = 'test_access_secret_key_minimum_32_characters';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_minimum_32_chars';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '30d';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.SOCKET_PORT = '5000';

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const {
  computeMedian,
  computePercentile,
  computeUptimePercentage,
  computeDowntimePercentage,
  computeErrorTrend,
  computeHealthScore,
  enrichKPIs,
} = await import('../../src/utils/monitoring.analytics.js');

// ── computeMedian ─────────────────────────────────────────────────────────────

describe('computeMedian', () => {
  it('returns the median of an odd-length sorted array', () => {
    expect(computeMedian([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns the average of the two middle values for even-length arrays', () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it('works with unsorted arrays', () => {
    expect(computeMedian([5, 3, 1, 4, 2])).toBe(3);
  });

  it('returns null for an empty array', () => {
    expect(computeMedian([])).toBeNull();
  });

  it('filters out null, undefined, and NaN values', () => {
    expect(computeMedian([null, 10, undefined, NaN, 20])).toBe(15);
  });

  it('returns the single element for a one-element array', () => {
    expect(computeMedian([42])).toBe(42);
  });

  it('handles duplicate values correctly', () => {
    expect(computeMedian([5, 5, 5, 5])).toBe(5);
  });

  it('handles decimal values', () => {
    expect(computeMedian([1.5, 2.5, 3.5])).toBe(2.5);
  });
});

// ── computePercentile ─────────────────────────────────────────────────────────

describe('computePercentile', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns the minimum for p0', () => {
    expect(computePercentile(values, 0)).toBe(1);
  });

  it('returns the maximum for p100', () => {
    expect(computePercentile(values, 100)).toBe(10);
  });

  it('computes p50 (median)', () => {
    expect(computePercentile(values, 50)).toBe(5.5);
  });

  it('computes p90 correctly', () => {
    expect(computePercentile(values, 90)).toBe(9.1);
  });

  it('computes p95 correctly', () => {
    expect(computePercentile(values, 95)).toBe(9.55);
  });

  it('returns null for empty array', () => {
    expect(computePercentile([], 95)).toBeNull();
  });

  it('filters out null and NaN', () => {
    expect(computePercentile([null, 10, null, 20], 50)).toBe(15);
  });

  it('throws RangeError for out-of-bounds percentile', () => {
    expect(() => computePercentile(values, 101)).toThrow(RangeError);
    expect(() => computePercentile(values, -1)).toThrow(RangeError);
  });
});

// ── computeUptimePercentage ───────────────────────────────────────────────────

describe('computeUptimePercentage', () => {
  it('returns the same value for 99.9 availability', () => {
    expect(computeUptimePercentage(99.9)).toBe(99.9);
  });

  it('returns 100 for 100% availability', () => {
    expect(computeUptimePercentage(100)).toBe(100);
  });

  it('returns 0 for 0% availability', () => {
    expect(computeUptimePercentage(0)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(computeUptimePercentage(105)).toBe(100);
  });

  it('clamps values below 0 to 0', () => {
    expect(computeUptimePercentage(-5)).toBe(0);
  });

  it('returns null for null input', () => {
    expect(computeUptimePercentage(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(computeUptimePercentage(undefined)).toBeNull();
  });

  it('returns null for NaN input', () => {
    expect(computeUptimePercentage(NaN)).toBeNull();
  });
});

// ── computeDowntimePercentage ─────────────────────────────────────────────────

describe('computeDowntimePercentage', () => {
  it('returns 0.1 downtime for 99.9 availability', () => {
    expect(computeDowntimePercentage(99.9)).toBe(0.1);
  });

  it('returns 0 downtime for 100% availability', () => {
    expect(computeDowntimePercentage(100)).toBe(0);
  });

  it('returns 100 downtime for 0% availability', () => {
    expect(computeDowntimePercentage(0)).toBe(100);
  });

  it('returns null for null input', () => {
    expect(computeDowntimePercentage(null)).toBeNull();
  });
});

// ── computeErrorTrend ─────────────────────────────────────────────────────────

describe('computeErrorTrend', () => {
  it('returns unknown for fewer than 2 snapshots', () => {
    expect(computeErrorTrend([]).trend).toBe('unknown');
    expect(computeErrorTrend([{ errorRate: 1 }]).trend).toBe('unknown');
  });

  it('returns unknown when errorRate values are all null', () => {
    const snaps = Array(4).fill({ errorRate: null });
    expect(computeErrorTrend(snaps).trend).toBe('unknown');
  });

  it('identifies a worsening trend when error rate increases', () => {
    const snaps = [
      { errorRate: 0.1 },
      { errorRate: 0.2 },
      { errorRate: 0.5 },
      { errorRate: 1.0 },
    ];
    const result = computeErrorTrend(snaps);
    expect(result.trend).toBe('worsening');
    expect(result.direction).toBe(1);
    expect(result.delta).toBeGreaterThan(0);
  });

  it('identifies an improving trend when error rate decreases', () => {
    const snaps = [
      { errorRate: 1.0 },
      { errorRate: 0.5 },
      { errorRate: 0.2 },
      { errorRate: 0.1 },
    ];
    const result = computeErrorTrend(snaps);
    expect(result.trend).toBe('improving');
    expect(result.direction).toBe(-1);
    expect(result.delta).toBeLessThan(0);
  });

  it('identifies a stable trend for minimal change', () => {
    const snaps = [
      { errorRate: 0.1 },
      { errorRate: 0.1 },
      { errorRate: 0.1 },
      { errorRate: 0.1 },
    ];
    const result = computeErrorTrend(snaps);
    expect(result.trend).toBe('stable');
    expect(result.direction).toBe(0);
  });

  it('handles mixed null and valid errorRate values', () => {
    const snaps = [
      { errorRate: null },
      { errorRate: 0.1 },
      { errorRate: null },
      { errorRate: 0.5 },
    ];
    const result = computeErrorTrend(snaps);
    // Should not throw
    expect(['improving', 'worsening', 'stable', 'unknown']).toContain(result.trend);
  });
});

// ── computeHealthScore ────────────────────────────────────────────────────────

describe('computeHealthScore', () => {
  it('returns null for null kpis', () => {
    expect(computeHealthScore(null)).toBeNull();
  });

  it('returns null when all KPI fields are null', () => {
    expect(
      computeHealthScore({
        avgCpu: null,
        avgMemory: null,
        avgAvailability: null,
        avgErrorRate: null,
      })
    ).toBeNull();
  });

  it('computes a high score for ideal metrics', () => {
    const score = computeHealthScore({
      avgCpu: 10,
      avgMemory: 20,
      avgAvailability: 99.9,
      avgErrorRate: 0.01,
    });
    expect(score).toBeGreaterThan(85);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('computes a low score for critical metrics', () => {
    const score = computeHealthScore({
      avgCpu: 95,
      avgMemory: 95,
      avgAvailability: 50,
      avgErrorRate: 10,
    });
    expect(score).toBeLessThan(30);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('computes partial score when only some metrics are available', () => {
    const score = computeHealthScore({
      avgCpu: 50,
      avgMemory: null,
      avgAvailability: null,
      avgErrorRate: null,
    });
    expect(score).not.toBeNull();
    expect(score).toBe(50); // 100 - 50 = 50 CPU score, fully weighted since only metric
  });

  it('returns a value in the range 0–100', () => {
    const score = computeHealthScore({
      avgCpu: 75,
      avgMemory: 60,
      avgAvailability: 98,
      avgErrorRate: 2,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── enrichKPIs ────────────────────────────────────────────────────────────────

describe('enrichKPIs', () => {
  const baseKpis = {
    avgCpu: 45.5,
    peakCpu: 80.0,
    avgMemory: 60.2,
    peakMemory: 85.0,
    avgDisk: 30.0,
    avgNetworkInbound: null,
    avgNetworkOutbound: null,
    avgResponseTime: 120,
    maxResponseTime: 300,
    minResponseTime: 50,
    avgAvailability: 99.9,
    avgErrorRate: 0.1,
    sampleCount: 100,
    responseTimes: [50, 80, 100, 120, 150, 200, 300],
  };

  it('returns null for null rawKpis', () => {
    expect(enrichKPIs(null)).toBeNull();
  });

  it('returns all required fields', () => {
    const result = enrichKPIs(baseKpis);
    expect(result).toHaveProperty('averages');
    expect(result).toHaveProperty('peaks');
    expect(result).toHaveProperty('percentiles');
    expect(result).toHaveProperty('uptime');
    expect(result).toHaveProperty('errorTrend');
    expect(result).toHaveProperty('healthScore');
    expect(result).toHaveProperty('sampleCount');
  });

  it('computes median response time', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.percentiles.p50ResponseTime).toBe(120); // median of [50,80,100,120,150,200,300]
  });

  it('computes p95 response time', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.percentiles.p95ResponseTime).not.toBeNull();
    expect(result.percentiles.p95ResponseTime).toBeGreaterThan(200);
  });

  it('computes uptime from availability', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.uptime.uptimePercentage).toBe(99.9);
    expect(result.uptime.downtimePercentage).toBe(0.1);
  });

  it('propagates sampleCount correctly', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.sampleCount).toBe(100);
  });

  it('sets averages structure correctly', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.averages.cpu).toBe(45.5);
    expect(result.averages.memory).toBe(60.2);
    expect(result.averages.availability).toBe(99.9);
  });

  it('sets peaks structure correctly', () => {
    const result = enrichKPIs(baseKpis);
    expect(result.peaks.cpu).toBe(80.0);
    expect(result.peaks.memory).toBe(85.0);
    expect(result.peaks.responseTime).toBe(300);
  });

  it('handles empty responseTimes array gracefully', () => {
    const kpisNoRT = { ...baseKpis, responseTimes: [] };
    const result = enrichKPIs(kpisNoRT);
    expect(result.percentiles.p50ResponseTime).toBeNull();
    expect(result.percentiles.p95ResponseTime).toBeNull();
  });
});
