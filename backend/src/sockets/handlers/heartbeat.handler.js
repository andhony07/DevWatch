import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { connectionService } from '../services/ConnectionService.js';

/**
 * Registers heartbeat event listeners for a socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export const registerHeartbeatHandlers = (io, socket) => {
  socket.on(APP_CONSTANTS.SOCKET.EVENTS.PONG, () => {
    connectionService.handlePong(socket);
  });
};
