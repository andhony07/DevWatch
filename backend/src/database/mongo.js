/**
 * @fileoverview Isolated database bootstrap module.
 *
 * Acts as the single public interface to all database operations.
 * Keeping this as a thin re-export layer ensures:
 *   - Other modules import from `database/mongo.js` (domain-level), not `config/database.js` (infrastructure).
 *   - The underlying database implementation can be swapped without touching calling code.
 *   - Circular dependency risks between config layers are avoided.
 */

export { connectDatabase, disconnectDatabase, getDatabaseStatus } from '../config/database.js';
