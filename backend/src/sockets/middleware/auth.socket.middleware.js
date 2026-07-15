import { verifyAccessToken } from '../../utils/jwt.util.js';
import { logger } from '../../config/logger.js';
import { User } from '../../models/User.model.js';

/**
 * Socket.IO middleware to authenticate incoming connections using JWT.
 * Validates the token from handshake.auth or handshake.headers.
 * Attaches the verified user to the socket object.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      socket.handshake.auth?.token ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      logger.warn(`[Socket Auth] Connection rejected: No token provided (${socket.id})`);
      return next(new Error('Authentication error: Token missing'));
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub).select('-password');

    if (!user || user.isDeleted || user.status !== 'active') {
      logger.warn(`[Socket Auth] Connection rejected: User invalid or inactive (${socket.id})`);
      return next(new Error('Authentication error: User invalid'));
    }

    // Attach authenticated user to socket
    socket.user = user;
    next();
  } catch (error) {
    logger.warn(`[Socket Auth] Connection rejected: Invalid token (${socket.id})`, {
      error: error.message,
    });
    return next(new Error('Authentication error: Invalid token'));
  }
};
