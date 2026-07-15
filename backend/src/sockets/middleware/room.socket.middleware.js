import { Project } from '../../models/Project.model.js';
import { logger } from '../../config/logger.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';
import mongoose from 'mongoose';

/**
 * Validates if the authenticated socket user is authorized to join the requested room.
 * Implements RBAC for project rooms: Admins have global access, owners/members have project access.
 *
 * @param {import('socket.io').Socket} socket
 * @param {string} roomName
 * @returns {Promise<boolean>}
 */
export const authorizeRoomJoin = async (socket, roomName) => {
  // We only authorize project rooms currently
  if (!roomName.startsWith(APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT)) {
    return true; // Global, monitoring, alerts namespaces/rooms allow all authenticated users for now
  }

  const projectId = roomName.replace(APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT, '');
  const { user } = socket;

  if (!user) {
    return false;
  }

  if (user.role === APP_CONSTANTS.ROLES.ADMIN) {
    return true; // Admins can join any room
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return false;
    }

    const project = await Project.findById(projectId);

    if (!project || project.isDeleted || project.status !== 'active') {
      return false; // Project does not exist or is inactive
    }

    const isOwner = project.owner.equals(user._id);
    const isMember = project.teamMembers.some((memberId) => memberId.equals(user._id));

    if (isOwner || isMember) {
      return true;
    }

    logger.warn(
      `[Socket Room Auth] Unauthorized attempt to join room ${roomName} by ${user.email}`
    );
    return false;
  } catch (error) {
    logger.error(`[Socket Room Auth] Error authorizing room join`, { error: error.message });
    return false;
  }
};
