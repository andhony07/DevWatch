/**
 * @fileoverview Application-wide response message constants.
 * No inline strings or magic text anywhere in the codebase.
 * All user-facing messages are defined here.
 */

export const MESSAGES = Object.freeze({
  // ── Generic ────────────────────────────────────────────────
  SUCCESS: 'Request completed successfully.',
  CREATED: 'Resource created successfully.',
  UPDATED: 'Resource updated successfully.',
  DELETED: 'Resource deleted successfully.',
  NOT_FOUND: 'The requested resource was not found.',
  BAD_REQUEST: 'The request contains invalid or missing parameters.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  UNAUTHORIZED: 'Authentication is required to access this resource.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  CONFLICT: 'A resource with this identifier already exists.',
  VALIDATION_ERROR: 'One or more fields failed validation.',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down and try again.',
  NOT_IMPLEMENTED: 'This feature is not yet implemented.',

  // ── Authentication ─────────────────────────────────────────
  AUTH: Object.freeze({
    LOGIN_SUCCESS: 'Login successful.',
    LOGOUT_SUCCESS: 'Logout successful.',
    REGISTER_SUCCESS: 'Registration successful. Welcome aboard.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    TOKEN_MISSING: 'Authentication token is missing.',
    TOKEN_INVALID: 'Authentication token is invalid or malformed.',
    TOKEN_EXPIRED: 'Authentication token has expired. Please log in again.',
    REFRESH_SUCCESS: 'Access token refreshed successfully.',
    REFRESH_TOKEN_MISSING: 'Refresh token is missing.',
    REFRESH_TOKEN_INVALID: 'Refresh token is invalid or has expired.',
    EMAIL_IN_USE: 'An account with this email address already exists.',
    ACCOUNT_INACTIVE: 'This account has been deactivated. Please contact support.',
    PASSWORD_RESET_SENT: 'Password reset instructions have been sent to your email.',
    PASSWORD_RESET_SUCCESS: 'Password has been reset successfully.',
    PASSWORD_RESET_TOKEN_INVALID: 'Password reset token is invalid or has expired.',
    PROFILE_FETCHED: 'User profile retrieved successfully.',
    EMAIL_VERIFICATION_SENT: 'A verification email has been dispatched to your inbox.',
    EMAIL_VERIFIED: 'Email address verified successfully.',
    EMAIL_ALREADY_VERIFIED: 'This email address is already verified.',
    EMAIL_VERIFY_TOKEN_INVALID: 'Email verification token is invalid or has expired.',
  }),

  // ── Health Check ───────────────────────────────────────────
  HEALTH: Object.freeze({
    OK: 'Service is healthy and fully operational.',
    DEGRADED: 'Service is degraded. Some features may be unavailable.',
    PING: 'Pong.',
  }),

  // ── Database ───────────────────────────────────────────────
  DATABASE: Object.freeze({
    CONNECTED: 'MongoDB connected successfully.',
    DISCONNECTED: 'MongoDB connection closed.',
    CONNECTION_ERROR: 'Failed to connect to MongoDB.',
    RECONNECTING: 'Attempting to reconnect to MongoDB...',
    RECONNECTED: 'MongoDB reconnected successfully.',
  }),

  // ── Server ────────────────────────────────────────────────
  SERVER: Object.freeze({
    STARTED: 'Server is running.',
    SHUTDOWN: 'Shutdown initiated. Closing connections gracefully...',
    GRACEFUL_SHUTDOWN: 'Server shut down gracefully. Goodbye.',
  }),

  // ── Monitoring ────────────────────────────────────────────────
  MONITORING: Object.freeze({
    // Existing messages (unchanged)
    METRIC_RECORDED: 'Metric recorded successfully.',
    ALERT_TRIGGERED: 'Alert condition has been triggered.',
    ALERT_RESOLVED: 'Alert has been resolved.',
    NO_DATA: 'No monitoring data available for the specified time range.',
    SERVICE_HEALTHY: 'Service is responding normally.',
    SERVICE_DEGRADED: 'Service is experiencing elevated response times.',
    SERVICE_DOWN: 'Service is not responding.',

    // Phase 6 — Snapshot
    SNAPSHOT_CREATED: 'Monitoring snapshot recorded successfully.',
    SNAPSHOT_NOT_FOUND: 'Monitoring snapshot not found.',
    LATEST_FETCHED: 'Latest metrics retrieved successfully.',
    HISTORY_FETCHED: 'Monitoring history retrieved successfully.',
    PROJECT_METRICS_FETCHED: 'Project metrics retrieved successfully.',

    // Phase 6 — Analytics
    ANALYTICS_FETCHED: 'Analytics data retrieved successfully.',
    ANALYTICS_NO_DATA: 'Insufficient data to compute analytics for the specified range.',

    // Phase 6 — Access control
    FORBIDDEN_READ: 'You do not have access to monitoring data for this project.',
    FORBIDDEN_WRITE: 'Only the project owner or an admin can record monitoring snapshots.',
    PROJECT_NOT_FOUND: 'The referenced project does not exist.',

    // Phase 6 — Scheduler / jobs
    SCHEDULER_STARTED: 'Monitoring scheduler started.',
    SCHEDULER_STOPPED: 'Monitoring scheduler stopped.',
    CLEANUP_COMPLETED: 'Data retention cleanup completed.',
    AGGREGATION_COMPLETED: 'Metric aggregation job completed.',
  }),

  // ── Analytics ────────────────────────────────────────────
  ANALYTICS: Object.freeze({
    REPORT_GENERATED: 'Report generated successfully.',
    NO_DATA: 'Insufficient data to generate this report.',
  }),

  // ── Notifications ─────────────────────────────────────────
  NOTIFICATIONS: Object.freeze({
    SENT: 'Notification sent successfully.',
    PREFERENCES_UPDATED: 'Notification preferences updated.',
  }),

  // ── Audit ─────────────────────────────────────────────────
  AUDIT: Object.freeze({
    LOG_CREATED: 'Audit event logged.',
    LOGS_FETCHED: 'Audit logs retrieved successfully.',
  }),

  // ── Project ───────────────────────────────────────────────────────────────────
  PROJECT: Object.freeze({
    CREATED: 'Project created successfully.',
    FETCHED: 'Project retrieved successfully.',
    LIST_FETCHED: 'Projects retrieved successfully.',
    UPDATED: 'Project updated successfully.',
    DELETED: 'Project deleted successfully.',
    RESTORED: 'Project restored successfully.',
    NOT_FOUND: 'Project not found.',
    DUPLICATE_NAME: 'A project with this name already exists for this owner.',
    FORBIDDEN_READ: 'You do not have access to this project.',
    FORBIDDEN_WRITE: 'Only the project owner or an admin can perform this action.',
    MEMBER_ADDED: 'Team member added successfully.',
    MEMBER_REMOVED: 'Team member removed successfully.',
    MEMBER_NOT_FOUND: 'The specified user does not exist.',
    MEMBER_ALREADY_EXISTS: 'This user is already a team member of the project.',
    MEMBER_NOT_IN_PROJECT: 'This user is not a member of the project.',
    CANNOT_REMOVE_OWNER: 'The project owner cannot be removed from team members.',
    RESTORE_NOT_DELETED: 'This project is not soft-deleted and cannot be restored.',
    ALREADY_DELETED: 'This project has already been deleted.',
  }),
});
