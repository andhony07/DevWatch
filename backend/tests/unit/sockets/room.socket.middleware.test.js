import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { APP_CONSTANTS } from '../../../src/constants/appConstants.js';

jest.unstable_mockModule('../../../src/models/Project.model.js', () => ({
  Project: {
    findById: jest.fn()
  }
}));

const { authorizeRoomJoin } = await import('../../../src/sockets/middleware/room.socket.middleware.js');
const { Project } = await import('../../../src/models/Project.model.js');

describe('Room Socket Middleware', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      id: 'socket-123',
      user: {
        _id: new mongoose.Types.ObjectId(),
        role: APP_CONSTANTS.ROLES.VIEWER,
      }
    };
    jest.clearAllMocks();
  });

  it('should allow joining non-project rooms without strict project checks', async () => {
    const isAuthorized = await authorizeRoomJoin(mockSocket, 'global');
    expect(isAuthorized).toBe(true);
  });

  it('should allow admin to join any project room', async () => {
    mockSocket.user.role = APP_CONSTANTS.ROLES.ADMIN;
    const isAuthorized = await authorizeRoomJoin(mockSocket, 'project:123456789012345678901234');
    
    expect(isAuthorized).toBe(true);
    expect(Project.findById).not.toHaveBeenCalled();
  });

  it('should reject if project ID is invalid', async () => {
    const isAuthorized = await authorizeRoomJoin(mockSocket, 'project:invalid-id');
    expect(isAuthorized).toBe(false);
  });

  it('should reject if project does not exist or is inactive', async () => {
    const validId = new mongoose.Types.ObjectId();
    Project.findById.mockResolvedValue(null);

    const isAuthorized = await authorizeRoomJoin(mockSocket, `project:${validId}`);
    expect(isAuthorized).toBe(false);
  });

  it('should allow project owner to join', async () => {
    const validId = new mongoose.Types.ObjectId();
    const mockProject = {
      _id: validId,
      status: 'active',
      isDeleted: false,
      owner: mockSocket.user._id,
      teamMembers: []
    };
    
    Project.findById.mockResolvedValue(mockProject);

    const isAuthorized = await authorizeRoomJoin(mockSocket, `project:${validId}`);
    expect(isAuthorized).toBe(true);
  });

  it('should allow project team member to join', async () => {
    const validId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    const mockProject = {
      _id: validId,
      status: 'active',
      isDeleted: false,
      owner: ownerId,
      teamMembers: [mockSocket.user._id]
    };
    
    Project.findById.mockResolvedValue(mockProject);

    const isAuthorized = await authorizeRoomJoin(mockSocket, `project:${validId}`);
    expect(isAuthorized).toBe(true);
  });

  it('should reject non-owner and non-member', async () => {
    const validId = new mongoose.Types.ObjectId();
    const mockProject = {
      _id: validId,
      status: 'active',
      isDeleted: false,
      owner: new mongoose.Types.ObjectId(),
      teamMembers: [new mongoose.Types.ObjectId()]
    };
    
    Project.findById.mockResolvedValue(mockProject);

    const isAuthorized = await authorizeRoomJoin(mockSocket, `project:${validId}`);
    expect(isAuthorized).toBe(false);
  });
});
