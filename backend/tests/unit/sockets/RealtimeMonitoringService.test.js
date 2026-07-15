import { jest } from '@jest/globals';
import { APP_CONSTANTS } from '../../../src/constants/appConstants.js';

jest.unstable_mockModule('../../../src/sockets/socket.js', () => ({
  broadcastToRoom: jest.fn(),
}));

const { realtimeMonitoringService } = await import('../../../src/sockets/services/RealtimeMonitoringService.js');
const socketModule = await import('../../../src/sockets/socket.js');

describe('RealtimeMonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should broadcast metric update to correct project room', () => {
    const projectId = 'project-123';
    const metricData = { cpu: 50 };

    realtimeMonitoringService.broadcastMetricUpdate(projectId, metricData);

    const expectedRoom = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    expect(socketModule.broadcastToRoom).toHaveBeenCalledWith(
      expectedRoom,
      APP_CONSTANTS.SOCKET.EVENTS.METRICS_UPDATE,
      expect.objectContaining({
        projectId,
        data: metricData,
        timestamp: expect.any(String)
      })
    );
  });

  it('should broadcast analytics to correct project room', () => {
    const projectId = 'project-456';
    const analyticsData = { sampleCount: 100 };

    realtimeMonitoringService.broadcastAnalytics(projectId, analyticsData);

    const expectedRoom = `${APP_CONSTANTS.SOCKET.ROOM_PREFIXES.PROJECT}${projectId}`;
    expect(socketModule.broadcastToRoom).toHaveBeenCalledWith(
      expectedRoom,
      APP_CONSTANTS.SOCKET.EVENTS.METRICS_ANALYTICS,
      expect.objectContaining({
        projectId,
        data: analyticsData,
        timestamp: expect.any(String)
      })
    );
  });

  it('should not broadcast if projectId is missing', () => {
    realtimeMonitoringService.broadcastMetricUpdate(null, { cpu: 50 });
    realtimeMonitoringService.broadcastAnalytics(undefined, { sampleCount: 100 });

    expect(socketModule.broadcastToRoom).not.toHaveBeenCalled();
  });
});
