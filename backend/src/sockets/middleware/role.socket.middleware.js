import { logger } from '../../config/logger.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';

/**
 * Higher-order function to wrap socket event handlers with role-based authorization.
 * Ensure only users with sufficient privileges can emit certain events.
 *
 * @param {string[]} allowedRoles Array of roles permitted to execute this handler
 * @param {Function} handler The actual socket event handler function
 * @returns {Function} Wrapped handler that checks roles before executing
 */
export const requireSocketRoles = (allowedRoles) => (handler) => (payload, callback, socket) => {
  try {
    const user = socket?.user;

    // Fallback if no user is attached (should be caught by auth middleware first)
    if (!user) {
      if (typeof callback === 'function') {
        return callback({ status: 'error', error: 'Unauthorized: No user attached' });
      }
      return;
    }

    // Admins bypass role checks
    if (user.role === APP_CONSTANTS.ROLES.ADMIN) {
      return handler(payload, callback, socket);
    }

    // Check if the user's role is in the allowed list
    if (!allowedRoles.includes(user.role)) {
      logger.warn(`[Socket Role Auth] Access denied for ${user.email} (Role: ${user.role})`);
      if (typeof callback === 'function') {
        return callback({ status: 'error', error: 'Forbidden: Insufficient permissions' });
      }
      return;
    }

    // Authorized, proceed
    return handler(payload, callback, socket);
  } catch (error) {
    logger.error('[Socket Role Auth] Error executing handler', { error: error.message });
    if (typeof callback === 'function') {
      return callback({ status: 'error', error: 'Internal server error during authorization' });
    }
  }
};
