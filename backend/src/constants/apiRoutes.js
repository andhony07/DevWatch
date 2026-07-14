/**
 * @fileoverview API route path constants.
 * Single source of truth for all route paths used in the application.
 * Prevents hardcoded strings across route files, tests, and middleware.
 */

/** @type {string} */
const API_PREFIX = '/api';

/** @type {string} */
const V1 = `${API_PREFIX}/v1`;

/**
 * All registered API route paths, grouped by feature domain.
 * @type {Readonly<object>}
 */
export const API_ROUTES = Object.freeze({
  PREFIX: API_PREFIX,
  V1,

  // ── Health ────────────────────────────────────────────────
  HEALTH: Object.freeze({
    BASE: `${V1}/health`,
    PING: `${V1}/health/ping`,
  }),

  // ── Authentication ────────────────────────────────────────
  AUTH: Object.freeze({
    BASE: `${V1}/auth`,
    REGISTER: `${V1}/auth/register`,
    LOGIN: `${V1}/auth/login`,
    LOGOUT: `${V1}/auth/logout`,
    REFRESH: `${V1}/auth/refresh`,
    ME: `${V1}/auth/me`,
    FORGOT_PASSWORD: `${V1}/auth/forgot-password`,
    RESET_PASSWORD: `${V1}/auth/reset-password`,
  }),

  // ── Monitoring ────────────────────────────────────────────
  MONITORING: Object.freeze({
    BASE: `${V1}/monitoring`,
    METRICS: `${V1}/monitoring/metrics`,
    ALERTS: `${V1}/monitoring/alerts`,
    SERVICES: `${V1}/monitoring/services`,
    INCIDENTS: `${V1}/monitoring/incidents`,
  }),

  // ── AI Engine ────────────────────────────────────────────
  AI: Object.freeze({
    BASE: `${V1}/ai`,
    ANALYZE: `${V1}/ai/analyze`,
    INSIGHTS: `${V1}/ai/insights`,
    PREDICTIONS: `${V1}/ai/predictions`,
    ANOMALIES: `${V1}/ai/anomalies`,
  }),

  // ── Analytics ─────────────────────────────────────────────
  ANALYTICS: Object.freeze({
    BASE: `${V1}/analytics`,
    DASHBOARD: `${V1}/analytics/dashboard`,
    REPORTS: `${V1}/analytics/reports`,
  }),

  // ── Infrastructure ────────────────────────────────────────
  KUBERNETES: Object.freeze({
    BASE: `${V1}/kubernetes`,
    CLUSTERS: `${V1}/kubernetes/clusters`,
    PODS: `${V1}/kubernetes/pods`,
    DEPLOYMENTS: `${V1}/kubernetes/deployments`,
  }),

  DOCKER: Object.freeze({
    BASE: `${V1}/docker`,
    CONTAINERS: `${V1}/docker/containers`,
    IMAGES: `${V1}/docker/images`,
  }),

  CICD: Object.freeze({
    BASE: `${V1}/cicd`,
    PIPELINES: `${V1}/cicd/pipelines`,
    BUILDS: `${V1}/cicd/builds`,
  }),

  // ── Notifications ─────────────────────────────────────────
  NOTIFICATIONS: Object.freeze({
    BASE: `${V1}/notifications`,
    PREFERENCES: `${V1}/notifications/preferences`,
  }),

  // ── Audit ─────────────────────────────────────────────────
  AUDIT: Object.freeze({
    BASE: `${V1}/audit`,
    LOGS: `${V1}/audit/logs`,
  }),
});
