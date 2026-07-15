import { broadcastToRoom } from '../socket.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { logger } from '../../config/logger.js';

class RealtimeAlertService {
  /**
   * Broadcasts a new alert to a specific project room.
   *
   * @param {string} projectId - The ID of the project
   * @param {object} alertData - The alert payload
   */
  broadcastAlertCreated(projectId, alertData) {
    if (!projectId) {
      return;
    }

    const room = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    const payload = {
      timestamp: new Date().toISOString(),
      projectId,
      data: alertData,
    };

    logger.debug(`[RealtimeAlertService] Broadcasting alert created to ${room}`);

    broadcastToRoom(room, APP_CONSTANTS.SOCKET.EVENTS.ALERT_CREATED, payload);
  }

  /**
   * Broadcasts an updated alert to a specific project room.
   *
   * @param {string} projectId - The ID of the project
   * @param {object} alertData - The alert payload
   */
  broadcastAlertUpdated(projectId, alertData) {
    if (!projectId) {
      return;
    }
    const room = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    const payload = {
      timestamp: new Date().toISOString(),
      projectId,
      data: alertData,
    };

    logger.debug(`[RealtimeAlertService] Broadcasting alert updated to ${room}`);

    broadcastToRoom(room, APP_CONSTANTS.SOCKET.EVENTS.ALERT_UPDATED, payload);
  }

  /**
   * Broadcasts an alert resolution to a specific project room.
   *
   * @param {string} projectId - The ID of the project
   * @param {object} alertData - The alert payload
   */
  broadcastAlertResolved(projectId, alertData) {
    if (!projectId) {
      return;
    }
    const room = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    const payload = {
      timestamp: new Date().toISOString(),
      projectId,
      data: alertData,
    };

    logger.debug(`[RealtimeAlertService] Broadcasting alert resolved to ${room}`);

    broadcastToRoom(room, APP_CONSTANTS.SOCKET.EVENTS.ALERT_RESOLVED, payload);
  }
}

export const realtimeAlertService = new RealtimeAlertService();
