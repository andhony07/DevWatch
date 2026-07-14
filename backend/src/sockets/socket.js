/**
 * @fileoverview Socket.IO server initialization and event management.
 *
 * Architecture:
 *   - Default namespace (/)         — general-purpose client connections, room management
 *   - /monitoring namespace         — real-time metric streaming (Phase 3)
 *   - /alerts namespace             — alert broadcast events (Phase 3)
 *   - /notifications namespace      — user notification push events (Phase 3)
 *
 * Public API:
 *   initializeSocket(httpServer)    — Boot Socket.IO, register all namespaces
 *   getIO()                         — Retrieve the active SocketServer instance
 *   broadcastToRoom(room, ev, data) — Emit to all sockets in a room
 *   broadcastToAll(event, data)     — Emit to all connected sockets
 */

import { Server as SocketServer } from 'socket.io';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { APP_CONSTANTS } from '../constants/appConstants.js';

const { SOCKET: SC } = APP_CONSTANTS;

/** @type {SocketServer | null} */
let io = null;

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Initializes the Socket.IO server, attaches it to the HTTP server,
 * and registers all namespace handlers.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance
 * @returns {SocketServer} The initialized Socket.IO server
 */
export const initializeSocket = (httpServer) => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: SC.PING_TIMEOUT_MS,
    pingInterval: SC.PING_INTERVAL_MS,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Register namespace handlers
  registerDefaultNamespace(io);
  registerMonitoringNamespace(io);
  registerAlertsNamespace(io);
  registerNotificationsNamespace(io);

  logger.info('Socket.IO server initialized.', {
    corsOrigin: config.clientUrl,
    transports: ['websocket', 'polling'],
    namespaces: [
      SC.NAMESPACES.DEFAULT,
      SC.NAMESPACES.MONITORING,
      SC.NAMESPACES.ALERTS,
      SC.NAMESPACES.NOTIFICATIONS,
    ],
  });

  return io;
};

// ── Default Namespace ─────────────────────────────────────────────────────────

/**
 * Registers connection lifecycle and room management events on the default namespace.
 * @param {SocketServer} socketServer
 * @returns {void}
 */
const registerDefaultNamespace = (socketServer) => {
  socketServer.on(SC.EVENTS.CONNECT, (socket) => {
    logger.info(`[Socket] Client connected — ${socket.id}`, {
      namespace: '/',
      socketId: socket.id,
      address: socket.handshake.address,
    });

    // All clients auto-join the global broadcast room
    socket.join(SC.ROOMS.GLOBAL);

    // ── Room Management ─────────────────────────────────────────────────────

    socket.on(SC.EVENTS.JOIN_ROOM, (room) => {
      if (typeof room !== 'string' || !room.trim()) {
        return;
      }

      socket.join(room.trim());
      socket.emit('room:joined', { room: room.trim(), socketId: socket.id });
      logger.debug(`[Socket] ${socket.id} joined room: ${room.trim()}`);
    });

    socket.on(SC.EVENTS.LEAVE_ROOM, (room) => {
      if (typeof room !== 'string' || !room.trim()) {
        return;
      }

      socket.leave(room.trim());
      socket.emit('room:left', { room: room.trim(), socketId: socket.id });
      logger.debug(`[Socket] ${socket.id} left room: ${room.trim()}`);
    });

    // ── Disconnect ──────────────────────────────────────────────────────────

    socket.on(SC.EVENTS.DISCONNECT, (reason) => {
      logger.info(`[Socket] Client disconnected — ${socket.id}`, {
        namespace: '/',
        socketId: socket.id,
        reason,
      });
    });

    // ── Error ───────────────────────────────────────────────────────────────

    socket.on(SC.EVENTS.ERROR, (error) => {
      logger.error(`[Socket] Error on ${socket.id}`, {
        error: error?.message ?? String(error),
      });
    });
  });
};

// ── Monitoring Namespace ──────────────────────────────────────────────────────

/**
 * Registers the /monitoring namespace for real-time metric streaming.
 * Phase 3 will add metric event emitters from the monitoring service.
 *
 * @param {SocketServer} socketServer
 * @returns {void}
 */
const registerMonitoringNamespace = (socketServer) => {
  const ns = socketServer.of(SC.NAMESPACES.MONITORING);

  ns.on(SC.EVENTS.CONNECT, (socket) => {
    logger.info(`[Socket/monitoring] Client connected — ${socket.id}`);
    socket.join(SC.ROOMS.MONITORING);

    socket.on(SC.EVENTS.DISCONNECT, (reason) => {
      logger.info(`[Socket/monitoring] Client disconnected — ${socket.id}`, { reason });
    });
  });
};

// ── Alerts Namespace ──────────────────────────────────────────────────────────

/**
 * Registers the /alerts namespace for push alert events.
 * Phase 3 will wire alert triggers from the monitoring engine.
 *
 * @param {SocketServer} socketServer
 * @returns {void}
 */
const registerAlertsNamespace = (socketServer) => {
  const ns = socketServer.of(SC.NAMESPACES.ALERTS);

  ns.on(SC.EVENTS.CONNECT, (socket) => {
    logger.info(`[Socket/alerts] Client connected — ${socket.id}`);
    socket.join(SC.ROOMS.ALERTS);

    socket.on(SC.EVENTS.DISCONNECT, (reason) => {
      logger.info(`[Socket/alerts] Client disconnected — ${socket.id}`, { reason });
    });
  });
};

// ── Notifications Namespace ───────────────────────────────────────────────────

/**
 * Registers the /notifications namespace for per-user push events.
 * Phase 3 will add user-room management and notification delivery.
 *
 * @param {SocketServer} socketServer
 * @returns {void}
 */
const registerNotificationsNamespace = (socketServer) => {
  const ns = socketServer.of(SC.NAMESPACES.NOTIFICATIONS);

  ns.on(SC.EVENTS.CONNECT, (socket) => {
    logger.info(`[Socket/notifications] Client connected — ${socket.id}`);
    socket.join(SC.ROOMS.NOTIFICATIONS);

    socket.on(SC.EVENTS.DISCONNECT, (reason) => {
      logger.info(`[Socket/notifications] Client disconnected — ${socket.id}`, { reason });
    });
  });
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the active Socket.IO server instance.
 * Throws if called before `initializeSocket`.
 *
 * @returns {SocketServer}
 * @throws {Error}
 */
export const getIO = () => {
  if (!io) {
    throw new Error(
      '[Socket] getIO() called before initializeSocket(). Ensure the socket is initialized in server.js.'
    );
  }
  return io;
};

/**
 * Broadcasts an event to all sockets in a given room (default namespace).
 *
 * @param {string} room - Target room name
 * @param {string} event - Event name (use APP_CONSTANTS.SOCKET.EVENTS)
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToRoom = (room, event, payload) => {
  if (!io) {
    return;
  }
  io.to(room).emit(event, payload);
};

/**
 * Broadcasts an event to ALL connected clients on the default namespace.
 *
 * @param {string} event - Event name
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToAll = (event, payload) => {
  if (!io) {
    return;
  }
  io.emit(event, payload);
};

/**
 * Broadcasts an event to all sockets in a specific namespace.
 *
 * @param {string} namespace - Namespace path (e.g. '/monitoring')
 * @param {string} event - Event name
 * @param {unknown} payload - Serializable event payload
 * @returns {void}
 */
export const broadcastToNamespace = (namespace, event, payload) => {
  if (!io) {
    return;
  }
  io.of(namespace).emit(event, payload);
};
