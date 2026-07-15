/**
 * @fileoverview Socket.IO entry point.
 * Exports initialization and broadcast methods, delegating to the unified SocketService.
 */

import { socketService } from './services/SocketService.js';

/**
 * Initializes the Socket.IO server, attaches it to the HTTP server,
 * and registers all handlers and middlewares.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance
 * @returns {import('socket.io').Server} The initialized Socket.IO server
 */
export const initializeSocket = (httpServer) => {
  return socketService.initialize(httpServer);
};

/**
 * Returns the active Socket.IO server instance.
 * Throws if called before `initializeSocket`.
 *
 * @returns {import('socket.io').Server}
 * @throws {Error}
 */
export const getIO = () => {
  return socketService.getIO();
};

/**
 * Broadcasts an event to all sockets in a given room.
 *
 * @param {string} room - Target room name
 * @param {string} event - Event name
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToRoom = (room, event, payload) => {
  const io = socketService.getIO();
  if (io) {
    io.to(room).emit(event, payload);
  }
};

/**
 * Broadcasts an event to ALL connected clients on the default namespace.
 *
 * @param {string} event - Event name
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToAll = (event, payload) => {
  const io = socketService.getIO();
  if (io) {
    io.emit(event, payload);
  }
};

/**
 * Broadcasts an event to all sockets in a specific namespace.
 *
 * @param {string} namespace - Namespace path
 * @param {string} event - Event name
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToNamespace = (namespace, event, payload) => {
  const io = socketService.getIO();
  if (io) {
    io.of(namespace).emit(event, payload);
  }
};
