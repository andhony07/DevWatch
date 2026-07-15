import { logger } from '../../config/logger.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { config } from '../../config/env.js';

class ConnectionService {
  constructor() {
    // Map to keep track of active connections for heartbeat management
    this.activeConnections = new Map();
  }

  /**
   * Register a new connection and start its heartbeat.
   *
   * @param {import('socket.io').Socket} socket
   */
  handleConnection(socket) {
    this.activeConnections.set(socket.id, {
      lastPong: Date.now(),
      user: socket.user,
      interval: this.startHeartbeat(socket),
    });

    logger.info(
      `[ConnectionService] Client connected — ${socket.id} (User: ${socket.user?.email})`
    );

    // Notify the client that connection and authentication was successful
    socket.emit(APP_CONSTANTS.SOCKET.EVENTS.SOCKET_AUTHENTICATED, {
      message: 'Successfully authenticated and connected',
      user: {
        id: socket.user?.id,
        email: socket.user?.email,
        role: socket.user?.role,
      },
      socketId: socket.id,
    });
  }

  /**
   * Handle socket disconnection. Clean up resources.
   *
   * @param {import('socket.io').Socket} socket
   * @param {string} reason
   */
  handleDisconnect(socket, reason) {
    const conn = this.activeConnections.get(socket.id);
    if (conn && conn.interval) {
      clearInterval(conn.interval);
    }

    this.activeConnections.delete(socket.id);

    logger.info(`[ConnectionService] Client disconnected — ${socket.id} (Reason: ${reason})`);
  }

  /**
   * Update the lastPong timestamp when a pong is received from the client.
   *
   * @param {import('socket.io').Socket} socket
   */
  handlePong(socket) {
    const conn = this.activeConnections.get(socket.id);
    if (conn) {
      conn.lastPong = Date.now();
      logger.debug(`[ConnectionService] Received pong from ${socket.id}`);
    }
  }

  /**
   * Starts a heartbeat interval that checks for stale connections.
   *
   * @param {import('socket.io').Socket} socket
   * @returns {NodeJS.Timeout}
   */
  startHeartbeat(socket) {
    const heartbeatInterval =
      config.socket.heartbeatInterval || APP_CONSTANTS.SOCKET.PING_INTERVAL_MS;
    const timeout = config.socket.timeout || APP_CONSTANTS.SOCKET.PING_TIMEOUT_MS;

    return setInterval(() => {
      const conn = this.activeConnections.get(socket.id);
      if (!conn) {
        return;
      }

      const now = Date.now();
      if (now - conn.lastPong > timeout) {
        logger.warn(
          `[ConnectionService] Stale connection detected (No pong received). Disconnecting socket ${socket.id}`
        );
        socket.disconnect(true);
      } else {
        socket.emit(APP_CONSTANTS.SOCKET.EVENTS.HEARTBEAT, { timestamp: now });
      }
    }, heartbeatInterval);
  }
}

export const connectionService = new ConnectionService();
