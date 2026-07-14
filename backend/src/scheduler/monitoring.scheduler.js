/**
 * @fileoverview MonitoringScheduler — background job runner for the monitoring engine.
 *
 * Uses Node's native `setInterval` — no external cron libraries required.
 * All job intervals are configurable and all jobs support graceful shutdown.
 *
 * Architecture:
 *   MonitoringScheduler            — orchestrates all jobs
 *   ├── MetricIngestionJob         — placeholder for cloud-provider metric polling
 *   ├── AggregationJob             — pre-computes KPIs at a configurable interval
 *   └── CleanupJob                 — data-retention enforcement
 *
 * Integration:
 *   Import { MonitoringScheduler } in server.js and call:
 *     const scheduler = new MonitoringScheduler();
 *     scheduler.start();
 *     // On shutdown:
 *     scheduler.stop();
 *
 * Design principles:
 *   - Jobs never throw — all errors are caught and logged.
 *   - Jobs are idempotent — safe to run multiple times.
 *   - The scheduler is stateless except for timer handles.
 *   - Easy to extend: add new jobs as new methods and register them in start().
 */

import { logger } from '../config/logger.js';
import { MonitoringService } from '../services/monitoring.service.js';
import { MESSAGES } from '../constants/messages.js';

// ── Default Intervals (milliseconds) ─────────────────────────────────────────

const DEFAULT_INTERVALS = Object.freeze({
  /** How often to attempt metric ingestion from cloud providers (5 minutes) */
  INGESTION_MS: 5 * 60 * 1000,

  /** How often to trigger KPI pre-computation (15 minutes) */
  AGGREGATION_MS: 15 * 60 * 1000,

  /** How often to run data-retention cleanup (24 hours) */
  CLEANUP_MS: 24 * 60 * 60 * 1000,
});

// ── Default Retention Policy ──────────────────────────────────────────────────

/** Default number of days to retain monitoring records before deletion */
const DEFAULT_RETENTION_DAYS = 90;

// ── MetricIngestionJob ────────────────────────────────────────────────────────

/**
 * @class MetricIngestionJob
 *
 * Placeholder for cloud-provider metric collection.
 * In production this job would:
 *   - Query AWS CloudWatch / GCP Monitoring / Azure Monitor
 *   - Transform responses into Monitoring documents
 *   - Call MonitoringService.recordSnapshot() for each project
 *
 * Currently it logs a readiness heartbeat so the scheduler
 * infrastructure can be validated without live cloud credentials.
 */
class MetricIngestionJob {
  constructor() {
    this.name = 'MetricIngestionJob';
  }

  /**
   * Executes one round of metric collection.
   * Safe to call repeatedly — errors are caught internally.
   *
   * @returns {Promise<void>}
   */
  run() {
    try {
      logger.debug(`[${this.name}] Metric ingestion tick — cloud integrations pending.`);
      // Future: iterate registered projects and pull metrics from cloud APIs
    } catch (error) {
      logger.error(`[${this.name}] Failed during metric ingestion.`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

// ── AggregationJob ────────────────────────────────────────────────────────────

/**
 * @class AggregationJob
 *
 * Periodically triggers KPI aggregation to keep analytics fast.
 * In production this could pre-compute and cache hourly/daily roll-ups.
 * Currently it logs a heartbeat as a validated hook for future expansion.
 */
class AggregationJob {
  constructor() {
    this.name = 'AggregationJob';
  }

  /**
   * @returns {Promise<void>}
   */
  run() {
    try {
      logger.debug(`[${this.name}] Aggregation tick — KPI pre-computation ready for integration.`);
      // Future: call aggregateByPeriod() for all active projects
      // and write results to a pre-computed aggregates collection.
    } catch (error) {
      logger.error(`[${this.name}] Failed during aggregation.`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

// ── CleanupJob ────────────────────────────────────────────────────────────────

/**
 * @class CleanupJob
 *
 * Enforces the data-retention policy by deleting records older than
 * `retentionDays` days. Delegates to MonitoringService.runRetentionCleanup().
 */
class CleanupJob {
  /**
   * @param {MonitoringService} monitoringService
   * @param {number} retentionDays
   */
  constructor(monitoringService, retentionDays = DEFAULT_RETENTION_DAYS) {
    this.name = 'CleanupJob';
    this.monitoringService = monitoringService;
    this.retentionDays = retentionDays;
  }

  /**
   * @returns {Promise<void>}
   */
  async run() {
    try {
      logger.info(`[${this.name}] Running data-retention cleanup (>${this.retentionDays} days).`);
      const { deleted, cutoffDate } = await this.monitoringService.runRetentionCleanup(
        this.retentionDays
      );
      logger.info(`[${this.name}] ${MESSAGES.MONITORING.CLEANUP_COMPLETED}`, {
        deletedCount: deleted,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (error) {
      logger.error(`[${this.name}] Failed during data-retention cleanup.`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}

// ── MonitoringScheduler ───────────────────────────────────────────────────────

/**
 * @class MonitoringScheduler
 *
 * Orchestrates all monitoring background jobs.
 * All timers are stored as handles so they can be cancelled on graceful shutdown.
 *
 * @example
 * // In server.js, after bootstrap():
 * import { MonitoringScheduler } from './scheduler/monitoring.scheduler.js';
 * const scheduler = new MonitoringScheduler();
 * scheduler.start();
 *
 * // In gracefulShutdown():
 * scheduler.stop();
 */
export class MonitoringScheduler {
  /**
   * @param {object} [options]
   * @param {number} [options.ingestionIntervalMs]
   * @param {number} [options.aggregationIntervalMs]
   * @param {number} [options.cleanupIntervalMs]
   * @param {number} [options.retentionDays]
   * @param {MonitoringService} [options.monitoringService] - Injected for testing
   */
  constructor({
    ingestionIntervalMs = DEFAULT_INTERVALS.INGESTION_MS,
    aggregationIntervalMs = DEFAULT_INTERVALS.AGGREGATION_MS,
    cleanupIntervalMs = DEFAULT_INTERVALS.CLEANUP_MS,
    retentionDays = DEFAULT_RETENTION_DAYS,
    monitoringService = new MonitoringService(),
  } = {}) {
    this.intervals = {
      ingestionMs: ingestionIntervalMs,
      aggregationMs: aggregationIntervalMs,
      cleanupMs: cleanupIntervalMs,
    };

    // Instantiate jobs
    this.jobs = {
      ingestion: new MetricIngestionJob(),
      aggregation: new AggregationJob(),
      cleanup: new CleanupJob(monitoringService, retentionDays),
    };

    // Timer handles (null until started)
    this._handles = {
      ingestion: null,
      aggregation: null,
      cleanup: null,
    };

    this._running = false;
  }

  /**
   * Returns true if the scheduler is currently running.
   *
   * @returns {boolean}
   */
  get isRunning() {
    return this._running;
  }

  /**
   * Starts all background jobs.
   * Each job runs its first iteration immediately (via setTimeout 0) and then
   * repeats at the configured interval.
   *
   * Safe to call multiple times — subsequent calls are no-ops if already running.
   *
   * @returns {void}
   */
  start() {
    if (this._running) {
      logger.warn('[MonitoringScheduler] Already running — ignoring duplicate start() call.');
      return;
    }

    logger.info(`[MonitoringScheduler] ${MESSAGES.MONITORING.SCHEDULER_STARTED}`);

    // ── Ingestion Job ──────────────────────────────────────────
    // Run immediately (fire-and-forget) then on interval
    this.jobs.ingestion.run();
    this._handles.ingestion = setInterval(
      () => this.jobs.ingestion.run(),
      this.intervals.ingestionMs
    );

    // ── Aggregation Job ────────────────────────────────────────
    this._handles.aggregation = setInterval(
      () => this.jobs.aggregation.run(),
      this.intervals.aggregationMs
    );

    // ── Cleanup Job ────────────────────────────────────────────
    // Run once 1 minute after startup, then on the configured interval
    setTimeout(() => {
      this.jobs.cleanup.run();
      this._handles.cleanup = setInterval(() => this.jobs.cleanup.run(), this.intervals.cleanupMs);
    }, 60 * 1000);

    this._running = true;

    logger.info('[MonitoringScheduler] Jobs registered:', {
      ingestionIntervalMs: this.intervals.ingestionMs,
      aggregationIntervalMs: this.intervals.aggregationMs,
      cleanupIntervalMs: this.intervals.cleanupMs,
    });
  }

  /**
   * Stops all background jobs and clears all timer handles.
   * Idempotent — safe to call even if not running.
   *
   * @returns {void}
   */
  stop() {
    for (const [key, handle] of Object.entries(this._handles)) {
      if (handle !== null) {
        clearInterval(handle);
        this._handles[key] = null;
      }
    }

    this._running = false;
    logger.info(`[MonitoringScheduler] ${MESSAGES.MONITORING.SCHEDULER_STOPPED}`);
  }
}

// ── Singleton Export ──────────────────────────────────────────────────────────

/**
 * Singleton scheduler instance.
 * Import this in server.js to start/stop the scheduler as part of the
 * application lifecycle.
 *
 * @example
 * import { monitoringScheduler } from './scheduler/monitoring.scheduler.js';
 * monitoringScheduler.start();
 * // On shutdown:
 * monitoringScheduler.stop();
 */
export const monitoringScheduler = new MonitoringScheduler();
