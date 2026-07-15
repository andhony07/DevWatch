import { logger } from '../../config/logger.js';

import { authorizeRoomJoin } from '../middleware/room.socket.middleware.js';

class RoomService {
  /**
   * Allows a socket to join a specified room after authorization.
   *
   * @param {import('socket.io').Socket} socket
   * @param {string} room
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  async joinRoom(socket, room) {
    try {
      if (!room || typeof room !== 'string' || !room.trim()) {
        return { success: false, message: 'Invalid room name' };
      }

      const trimmedRoom = room.trim();

      // Check authorization
      const isAuthorized = await authorizeRoomJoin(socket, trimmedRoom);

      if (!isAuthorized) {
        return { success: false, message: 'Unauthorized to join this room' };
      }

      // Join the room
      socket.join(trimmedRoom);
      logger.info(
        `[RoomService] Socket ${socket.id} (User: ${socket.user?.email}) joined room: ${trimmedRoom}`
      );

      // Notify the room (except the sender) that someone joined, if needed
      // socket.to(trimmedRoom).emit(APP_CONSTANTS.SOCKET.EVENTS.PROJECT_MEMBER_ADDED, { userId: socket.user?._id });

      return { success: true };
    } catch (error) {
      logger.error(`[RoomService] Error joining room ${room}`, { error: error.message });
      return { success: false, message: 'Internal server error while joining room' };
    }
  }

  /**
   * Allows a socket to leave a specified room.
   *
   * @param {import('socket.io').Socket} socket
   * @param {string} room
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  leaveRoom(socket, room) {
    try {
      if (!room || typeof room !== 'string' || !room.trim()) {
        return { success: false, message: 'Invalid room name' };
      }

      const trimmedRoom = room.trim();

      // Leave the room
      socket.leave(trimmedRoom);
      logger.info(
        `[RoomService] Socket ${socket.id} (User: ${socket.user?.email}) left room: ${trimmedRoom}`
      );

      return { success: true };
    } catch (error) {
      logger.error(`[RoomService] Error leaving room ${room}`, { error: error.message });
      return { success: false, message: 'Internal server error while leaving room' };
    }
  }

  /**
   * Automatically rejoins a user to their previous rooms upon reconnection.
   * This typically relies on client providing the rooms or session recovery.
   *
   * @param {import('socket.io').Socket} socket
   * @param {string[]} previousRooms
   */
  async recoverRooms(socket, previousRooms) {
    if (!Array.isArray(previousRooms) || previousRooms.length === 0) {
      return;
    }

    for (const room of previousRooms) {
      // Re-authorize and join each room
      const res = await this.joinRoom(socket, room);
      if (!res.success) {
        logger.warn(
          `[RoomService] Failed to recover room ${room} for socket ${socket.id}: ${res.message}`
        );
      }
    }
  }
}

export const roomService = new RoomService();
