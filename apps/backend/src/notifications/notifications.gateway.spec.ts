import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

// ── Mock Socket ───────────────────────────────────────────────────
const makeSocket = (overrides = {}) => ({
  id: 'socket-id-123',
  join: jest.fn(),
  emit: jest.fn(),
  ...overrides,
});

// ── Mock Server ───────────────────────────────────────────────────
const makeServer = () => ({
  to: jest.fn().mockReturnThis(),  // allows chaining: server.to(...).emit(...)
  emit: jest.fn(),
});

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let mockServer: ReturnType<typeof makeServer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    mockServer = makeServer();

    // Inject mock server — bypasses real Socket.io initialization
    (gateway as any).server = mockServer;

    // Silence logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });
    jest.clearAllMocks();

    // Re-inject server after clearAllMocks (clear resets the mock server too)
    mockServer = makeServer();
    (gateway as any).server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // ── handleConnection() ────────────────────────────────────────────

  describe('handleConnection()', () => {

    it('should log when client connects', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });
      const socket = makeSocket();

      gateway.handleConnection(socket as any);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-id-123')
      );
    });

    it('should not throw on client connection', () => {
      const socket = makeSocket();

      expect(() => gateway.handleConnection(socket as any)).not.toThrow();
    });

  });

  // ── handleDisconnect() ────────────────────────────────────────────

  describe('handleDisconnect()', () => {

    it('should log when client disconnects', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });
      const socket = makeSocket();

      gateway.handleDisconnect(socket as any);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('socket-id-123')
      );
    });

    it('should not throw on client disconnection', () => {
      const socket = makeSocket();

      expect(() => gateway.handleDisconnect(socket as any)).not.toThrow();
    });

  });

  // ── handleJoin() ──────────────────────────────────────────────────

  describe('handleJoin()', () => {

    it('should join the user room with correct room name', () => {
      const socket = makeSocket();
      const data = { userId: 'user-uuid' };

      gateway.handleJoin(data, socket as any);

      expect(socket.join).toHaveBeenCalledWith('user:user-uuid');
      expect(socket.join).toHaveBeenCalledTimes(1);
    });

    it('should log after joining room', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => { });
      const socket = makeSocket();

      gateway.handleJoin({ userId: 'user-uuid' }, socket as any);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('user:user-uuid')
      );
    });

    it('should join different rooms for different users', () => {
      const socket1 = makeSocket({ id: 'socket-1' });
      const socket2 = makeSocket({ id: 'socket-2' });

      gateway.handleJoin({ userId: 'user-1' }, socket1 as any);
      gateway.handleJoin({ userId: 'user-2' }, socket2 as any);

      expect(socket1.join).toHaveBeenCalledWith('user:user-1');
      expect(socket2.join).toHaveBeenCalledWith('user:user-2');
    });

    it('should not emit anything when joining — just joins the room', () => {
      const socket = makeSocket();

      gateway.handleJoin({ userId: 'user-uuid' }, socket as any);

      expect(socket.emit).not.toHaveBeenCalled();
    });

  });

  // ── notifyUser() ──────────────────────────────────────────────────

  describe('notifyUser()', () => {

    it('should emit notification:new to the correct user room', () => {
      const payload = { title: 'Test', message: 'Hello', type: 'SCHEDULE_CREATED' };

      gateway.notifyUser('user-uuid', payload);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-uuid');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', payload);
    });

    it('should target the correct room format user:{userId}', () => {
      gateway.notifyUser('abc-123', { title: 'Test' });

      expect(mockServer.to).toHaveBeenCalledWith('user:abc-123');
    });

    it('should emit with full payload intact', () => {
      const payload = {
        title: 'Schedule approved',
        message: 'Your booking has been approved',
        type: 'SCHEDULE_APPROVED',
        sentAt: '2026-06-10T08:00:00Z',
      };

      gateway.notifyUser('user-uuid', payload);

      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', payload);
    });

    it('should call server.to().emit() in chain', () => {
      const payload = { title: 'Test' };
      gateway.notifyUser('user-uuid', payload);

      // Verify chaining: server.to(...) returns server, then .emit() is called
      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

  });

  // ── notifyUsers() ─────────────────────────────────────────────────

  describe('notifyUsers()', () => {

    it('should call notifyUser for each userId', () => {
      const notifyUserSpy = jest.spyOn(gateway, 'notifyUser');
      const payload = { title: 'Bulk notification' };
      const userIds = ['user-1', 'user-2', 'user-3'];

      gateway.notifyUsers(userIds, payload);

      expect(notifyUserSpy).toHaveBeenCalledTimes(3);
      expect(notifyUserSpy).toHaveBeenCalledWith('user-1', payload);
      expect(notifyUserSpy).toHaveBeenCalledWith('user-2', payload);
      expect(notifyUserSpy).toHaveBeenCalledWith('user-3', payload);
    });

    it('should emit to each user room', () => {
      const payload = { title: 'Multi-user notification' };

      gateway.notifyUsers(['user-1', 'user-2'], payload);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.to).toHaveBeenCalledWith('user:user-2');
      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });

    it('should not emit anything when userIds is empty', () => {
      gateway.notifyUsers([], { title: 'Empty' });

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should work correctly with a single userId', () => {
      const payload = { title: 'Single user' };

      gateway.notifyUsers(['user-1'], payload);

      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', payload);
      expect(mockServer.to).toHaveBeenCalledTimes(1);
    });

    it('should pass same payload to all users', () => {
      const payload = { title: 'Same payload', message: 'For everyone' };

      gateway.notifyUsers(['user-1', 'user-2'], payload);

      const emitCalls = mockServer.emit.mock.calls;
      expect(emitCalls[0][1]).toEqual(payload);
      expect(emitCalls[1][1]).toEqual(payload);
    });

  });

  // ── notifyAll() ───────────────────────────────────────────────────

  describe('notifyAll()', () => {

    it('should emit notification:new to all connected clients', () => {
      const payload = { title: 'Global announcement', type: 'SYSTEM_ANNOUNCEMENT' };

      gateway.notifyAll(payload);

      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', payload);
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

    it('should NOT call server.to() — broadcasts directly', () => {
      gateway.notifyAll({ title: 'Broadcast' });

      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should emit with full payload intact', () => {
      const payload = {
        title: 'System maintenance',
        message: 'Server will be down at 2AM',
        type: 'SYSTEM_ANNOUNCEMENT',
        sentAt: '2026-06-10T00:00:00Z',
      };

      gateway.notifyAll(payload);

      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', payload);
    });

    it('should work with empty payload object', () => {
      expect(() => gateway.notifyAll({})).not.toThrow();
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', {});
    });

  });

  // ── notifyUser vs notifyAll behavior ──────────────────────────────

  describe('notifyUser vs notifyAll behavior', () => {

    it('notifyUser should use server.to() — targeted', () => {
      gateway.notifyUser('user-uuid', { title: 'Personal' });

      expect(mockServer.to).toHaveBeenCalledTimes(1);   // targeted
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

    it('notifyAll should NOT use server.to() — global', () => {
      gateway.notifyAll({ title: 'Global' });

      expect(mockServer.to).not.toHaveBeenCalled();      // not targeted
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

  });

});