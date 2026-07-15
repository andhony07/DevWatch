import { Server as SocketServer } from 'socket.io';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { socketAuthMiddleware } from '../middleware/auth.socket.middleware.js';
import { connectionHandler } from '../handlers/connection.handler.js';

const { SOCKET: SC } = APP_CONSTANTS;

class SocketService {
  constructor() {
    /** @type {SocketServer | null} */
    this.io = null;
  }

  /**
   * Initializes the Socket.IO server, registers middlewares, and sets up handlers.
   *
   * @param {import('http').Server} httpServer
   * @returns {SocketServer}
   */
  initialize(httpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: config.clientUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: config.socket?.timeout || SC.PING_TIMEOUT_MS,
      pingInterval: config.socket?.heartbeatInterval || SC.PING_INTERVAL_MS,
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    });

    // Register root namespace middleware
    this.io.use(socketAuthMiddleware);

    // Register root namespace connection handler
    this.io.on(SC.EVENTS.CONNECT, (socket) => {
      connectionHandler(this.io, socket);
    });

    logger.info('Socket.IO server initialized with authentication and handlers.', {
      corsOrigin: config.clientUrl,
      transports: ['websocket', 'polling'],
    });

    return this.io;
  }

  /**
   * Returns the active Socket.IO server instance.
   * Throws if called before initialization.
   *
   * @returns {SocketServer}
   */
  getIO() {
    if (!this.io) {
      throw new Error('[SocketService] getIO() called before initialize().');
    }
    return this.io;
  }
}

export const socketService = new SocketService();
