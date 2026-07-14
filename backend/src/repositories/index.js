/**
 * @fileoverview Repositories barrel — single import point for all repository classes.
 *
 * Import from this file instead of individual repository files to keep import
 * paths stable across services and controllers.
 *
 * Each repository is exported as a named class. Consumers are responsible for
 * instantiation (or dependency injection in future phases).
 *
 * @example
 * import { UserRepository, ProjectRepository } from '../repositories/index.js';
 * const userRepo = new UserRepository();
 */

export { BaseRepository } from './BaseRepository.js';
export { UserRepository } from './UserRepository.js';
export { ProjectRepository } from './ProjectRepository.js';
export { MonitoringRepository } from './MonitoringRepository.js';
export { AlertRepository } from './AlertRepository.js';
export { AIAnalysisRepository } from './AIAnalysisRepository.js';
export { NotificationRepository } from './NotificationRepository.js';
export { AuditRepository } from './AuditRepository.js';
