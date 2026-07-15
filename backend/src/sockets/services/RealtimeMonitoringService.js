import { broadcastToRoom } from '../socket.js';
import { APP_CONSTANTS } from '../../constants/appConstants.js';
import { logger } from '../../config/logger.js';

class RealtimeMonitoringService {
  /**
   * Broadcasts the latest metrics to a specific project room.
   * Should be called whenever a new monitoring snapshot is saved.
   *
   * @param {string} projectId - The ID of the project
   * @param {object} metricData - The new metrics data payload
   */
  broadcastMetricUpdate(projectId, metricData) {
    if (!projectId) {
      return;
    }
    const room = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    const payload = {
      timestamp: new Date().toISOString(),
      projectId,
      data: metricData,
    };

    logger.debug(`[RealtimeMonitoringService] Broadcasting metrics update to ${room}`);

    broadcastToRoom(room, APP_CONSTANTS.SOCKET.EVENTS.METRICS_UPDATE, payload);
  }

  /**
   * Broadcasts aggregated analytics data to a specific project room.
   *
   * @param {string} projectId - The ID of the project
   * @param {object} analyticsData - The analytics payload
   */
  broadcastAnalytics(projectId, analyticsData) {
    if (!projectId) {
      return;
    }
    const room = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    const payload = {
      timestamp: new Date().toISOString(),
      projectId,
      data: analyticsData,
    };

    logger.debug(`[RealtimeMonitoringService] Broadcasting analytics update to ${room}`);

    broadcastToRoom(room, APP_CONSTANTS.SOCKET.EVENTS.METRICS_ANALYTICS, payload);
  }
}

export const realtimeMonitoringService = new RealtimeMonitoringService();
