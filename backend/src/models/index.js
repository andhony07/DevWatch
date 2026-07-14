/**
 * @fileoverview Models barrel — single import point for all Mongoose models.
 *
 * Import from this file instead of individual model files to keep import
 * paths stable across services, controllers, and repositories.
 *
 * @example
 * import { User, Project, Alert } from '../models/index.js';
 */

export { User } from './User.model.js';
export {
  Project,
  CLOUD_PROVIDERS,
  PROJECT_ENVIRONMENTS,
  PROJECT_STATUSES,
} from './Project.model.js';
export { Monitoring } from './Monitoring.model.js';
export { Alert, ALERT_SEVERITIES, ALERT_STATUSES, ALERT_SOURCES } from './Alert.model.js';
export { AIAnalysis } from './AIAnalysis.model.js';
export { Notification, NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from './Notification.model.js';
export { AuditLog, AUDIT_ACTIONS, AUDIT_RESOURCES } from './AuditLog.model.js';
