import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { roomService } from '../services/RoomService.js';

/**
 * Registers room-related event listeners for a socket.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export const registerRoomHandlers = (io, socket) => {
  socket.on(APP_CONSTANTS.SOCKET.EVENTS.JOIN_ROOM, async (payload, callback) => {
    // Payload might be a string (room name) or an object { room: '...' }
    const room = typeof payload === 'string' ? payload : payload?.room;
    const res = await roomService.joinRoom(socket, room);

    // Acknowledgement support
    if (typeof callback === 'function') {
      callback({
        success: res.success,
        timestamp: Date.now(),
        room,
        error: res.message,
      });
    }
  });

  socket.on(APP_CONSTANTS.SOCKET.EVENTS.LEAVE_ROOM, async (payload, callback) => {
    const room = typeof payload === 'string' ? payload : payload?.room;
    const res = await roomService.leaveRoom(socket, room);

    // Acknowledgement support
    if (typeof callback === 'function') {
      callback({
        success: res.success,
        timestamp: Date.now(),
        room,
        error: res.message,
      });
    }
  });
};
