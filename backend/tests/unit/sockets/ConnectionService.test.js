import { connectionService } from '../../../src/sockets/services/ConnectionService.js';
import { APP_CONSTANTS } from '../../../src/constants/appConstants.js';
import { config } from '../../../src/config/env.js';
import { jest } from '@jest/globals';

jest.useFakeTimers();

describe('ConnectionService', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      id: 'socket-123',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'viewer'
      },
      emit: jest.fn(),
      disconnect: jest.fn()
    };
    connectionService.activeConnections.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    connectionService.activeConnections.forEach(conn => {
      if (conn.interval) clearInterval(conn.interval);
    });
  });

  it('should handle connection and emit authenticated event', () => {
    connectionService.handleConnection(mockSocket);

    expect(connectionService.activeConnections.has(mockSocket.id)).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      APP_CONSTANTS.SOCKET.EVENTS.SOCKET_AUTHENTICATED,
      expect.objectContaining({
        message: 'Successfully authenticated and connected',
        socketId: mockSocket.id,
        user: expect.objectContaining({ email: 'test@example.com' })
      })
    );
  });

  it('should handle disconnection and cleanup', () => {
    connectionService.handleConnection(mockSocket);
    const conn = connectionService.activeConnections.get(mockSocket.id);
    const intervalSpy = jest.spyOn(global, 'clearInterval');

    connectionService.handleDisconnect(mockSocket, 'client disconnect');

    expect(connectionService.activeConnections.has(mockSocket.id)).toBe(false);
    expect(intervalSpy).toHaveBeenCalledWith(conn.interval);
  });

  it('should update lastPong on handlePong', () => {
    connectionService.handleConnection(mockSocket);
    const conn = connectionService.activeConnections.get(mockSocket.id);
    
    // Simulate time passing
    jest.advanceTimersByTime(5000);
    const timeBeforePong = Date.now();
    
    connectionService.handlePong(mockSocket);
    
    expect(conn.lastPong).toBeGreaterThanOrEqual(timeBeforePong);
  });

  it('should disconnect stale connections during heartbeat check', () => {
    // Force timeout to a small value for test if needed, but we can just use advanceTimersByTime
    connectionService.handleConnection(mockSocket);
    
    const timeout = config.socket?.timeout || APP_CONSTANTS.SOCKET.PING_TIMEOUT_MS;
    const interval = config.socket?.heartbeatInterval || APP_CONSTANTS.SOCKET.PING_INTERVAL_MS;

    // Advance time past the timeout without any pong
    jest.advanceTimersByTime(timeout + interval + 1000);

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });
});
