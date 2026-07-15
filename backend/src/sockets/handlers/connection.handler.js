import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { logger } from '../../config/logger.js';
import { connectionService } from '../services/ConnectionService.js';
import { registerRoomHandlers } from './room.handler.js';
import { registerHeartbeatHandlers } from './heartbeat.handler.js';

/**
 * Handles the initial connection lifecycle for a socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export const connectionHandler = (io, socket) => {
  // Register connection in ConnectionService (starts heartbeat, sends auth ack)
  connectionService.handleConnection(socket);

  // Auto-join global room
  socket.join(APP_CONSTANTS.SOCKET.ROOMS.GLOBAL);

  // Register feature handlers
  registerRoomHandlers(io, socket);
  registerHeartbeatHandlers(io, socket);

  // Handle disconnect
  socket.on(APP_CONSTANTS.SOCKET.EVENTS.DISCONNECT, (reason) => {
    connectionService.handleDisconnect(socket, reason);
  });

  // Handle general socket errors
  socket.on(APP_CONSTANTS.SOCKET.EVENTS.ERROR, (error) => {
    logger.error(`[Socket] Error on ${socket.id}`, {
      error: error?.message ?? String(error),
      user: socket.user?.email,
    });
  });
};
