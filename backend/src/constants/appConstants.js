/**
 * @fileoverview Application-wide configuration constants and enumerations.
 * Single source of truth for all non-secret, non-environment-specific values.
 */

export const APP_CONSTANTS = Object.freeze({
  APP_NAME: 'DevWatch',
  APP_TAGLINE: 'AI Cloud-Based DevOps Monitoring Dashboard',
  APP_VERSION: '1.0.0',
  API_VERSION: 'v1',
  COMPANY: 'DevWatch Team',

  // ── Pagination ────────────────────────────────────────────
  PAGINATION: Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  }),

  // ── JWT ───────────────────────────────────────────────────
  JWT: Object.freeze({
    ALGORITHM: 'HS256',
    COOKIE_NAME: 'devwatch_token',
    REFRESH_COOKIE_NAME: 'devwatch_refresh',
    COOKIE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  }),

  // ── Rate Limiting ─────────────────────────────────────────
  RATE_LIMIT: Object.freeze({
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100,
    SKIP_SUCCESSFUL_REQUESTS: false,
  }),

  // ── MongoDB ───────────────────────────────────────────────
  MONGO: Object.freeze({
    MAX_RETRIES: 5,
    RETRY_DELAY_MS: 5000,
    SERVER_SELECTION_TIMEOUT_MS: 5000,
    SOCKET_TIMEOUT_MS: 45000,
    HEARTBEAT_FREQUENCY_MS: 10000,
  }),

  // ── Socket.IO ─────────────────────────────────────────────
  SOCKET: Object.freeze({
    NAMESPACES: Object.freeze({
      DEFAULT: '/',
      MONITORING: '/monitoring',
      ALERTS: '/alerts',
      NOTIFICATIONS: '/notifications',
    }),
    EVENTS: Object.freeze({
      // Connection
      CONNECT: 'connection',
      DISCONNECT: 'disconnect',
      ERROR: 'error',
      SOCKET_CONNECTED: 'socket:connected',
      SOCKET_AUTHENTICATED: 'socket:authenticated',
      SOCKET_DISCONNECTED: 'socket:disconnected',

      // Rooms
      JOIN_ROOM: 'room:join',
      LEAVE_ROOM: 'room:leave',

      // Monitoring
      METRICS_UPDATE: 'metrics:update',
      METRICS_LATEST: 'metrics:latest',
      METRICS_HISTORY: 'metrics:history',
      METRICS_ANALYTICS: 'metrics:analytics',

      // Alerts
      ALERT_CREATED: 'alert:created',
      ALERT_UPDATED: 'alert:updated',
      ALERT_RESOLVED: 'alert:resolved',

      // Projects
      PROJECT_UPDATED: 'project:updated',
      PROJECT_MEMBER_ADDED: 'project:memberAdded',
      PROJECT_MEMBER_REMOVED: 'project:memberRemoved',

      // System
      HEARTBEAT: 'heartbeat',
      PONG: 'pong',
      SERVER_SHUTDOWN: 'server:shutdown',
    }),
    ROOMS: Object.freeze({
      GLOBAL: 'global',
      MONITORING: 'monitoring',
      ALERTS: 'alerts',
      NOTIFICATIONS: 'notifications',
    }),
    ROOM_PREFIXES: Object.freeze({
      PROJECT: 'project:',
    }),
    PING_TIMEOUT_MS: 60000,
    PING_INTERVAL_MS: 25000,
  }),

  // ── User Roles ────────────────────────────────────────────
  ROLES: Object.freeze({
    ADMIN: 'admin',
    OPERATOR: 'operator',
    VIEWER: 'viewer',
  }),

  // ── Log Levels ────────────────────────────────────────────
  LOG_LEVELS: Object.freeze({
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    HTTP: 'http',
    DEBUG: 'debug',
  }),

  // ── Environments ──────────────────────────────────────────
  ENVIRONMENTS: Object.freeze({
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test',
  }),

  // ── File Upload ───────────────────────────────────────────
  UPLOAD: Object.freeze({
    MAX_FILE_SIZE_MB: 10,
    ALLOWED_MIME_TYPES: Object.freeze([
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/json',
    ]),
  }),

  // ── Password ──────────────────────────────────────────────
  PASSWORD: Object.freeze({
    SALT_ROUNDS: 12,
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  }),
});
