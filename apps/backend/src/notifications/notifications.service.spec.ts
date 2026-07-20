import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotifEnum } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { mockNotificationsRepository } from './__mocks__/notifications.repository.mock';
import { mockNotificationsGateway } from './__mocks__/notifications.gateway.mock';

// ── Helpers ──────────────────────────────────────────────────────────
const makeNotification = (overrides = {}) => ({
  id: 'notif-uuid',
  userId: 'user-uuid',
  title: 'Test notification',
  message: 'This is a test',
  type: NotifEnum.SCHEDULE_CREATED,
  isRead: false,
  sentAt: new Date(),
  ...overrides,
});

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // ── findAll() ────────────────────────────────────────────────────────

  describe('findAll()', () => {

    it('should return notifications for the user', async () => {
      const notifications = [makeNotification(), makeNotification({ id: 'notif-2' })];
      mockNotificationsRepository.findMany.mockResolvedValue(notifications);

      const result = await service.findAll('user-uuid', {});

      expect(result).toEqual(notifications);
      expect(mockNotificationsRepository.findMany)
        .toHaveBeenCalledWith('user-uuid', {});
    });

    it('should return empty array when user has no notifications', async () => {
      mockNotificationsRepository.findMany.mockResolvedValue([]);

      const result = await service.findAll('user-uuid', {});

      expect(result).toHaveLength(0);
    });

    it('should filter by isRead when provided', async () => {
      const unread = [makeNotification({ isRead: false })];
      mockNotificationsRepository.findMany.mockResolvedValue(unread);

      const result = await service.findAll('user-uuid', { isRead: false });

      expect(result).toEqual(unread);
      expect(mockNotificationsRepository.findMany)
        .toHaveBeenCalledWith('user-uuid', { isRead: false });
    });

  });

  // ── unreadCount() ────────────────────────────────────────────────────

  describe('unreadCount()', () => {

    it('should return unread count for user', async () => {
      mockNotificationsRepository.countUnread.mockResolvedValue(5);

      const result = await service.unreadCount('user-uuid');

      expect(result).toEqual({ unreadCount: 5 });
      expect(mockNotificationsRepository.countUnread)
        .toHaveBeenCalledWith('user-uuid');
    });

    it('should return 0 when no unread notifications', async () => {
      mockNotificationsRepository.countUnread.mockResolvedValue(0);

      const result = await service.unreadCount('user-uuid');

      expect(result).toEqual({ unreadCount: 0 });
    });

  });

  // ── markAsRead() ─────────────────────────────────────────────────────

  describe('markAsRead()', () => {

    it('should mark notification as read when owner requests', async () => {
      const notification = makeNotification();
      const updated = makeNotification({ isRead: true });
      mockNotificationsRepository.findById.mockResolvedValue(notification);
      mockNotificationsRepository.markAsRead.mockResolvedValue(updated);

      const result = await service.markAsRead('notif-uuid', 'user-uuid');

      expect(result.isRead).toBe(true);
      expect(mockNotificationsRepository.markAsRead)
        .toHaveBeenCalledWith('notif-uuid');
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent', 'user-uuid'))
        .rejects.toThrow(NotFoundException);

      await expect(service.markAsRead('non-existent', 'user-uuid'))
        .rejects.toThrow('Notification not found');

      expect(mockNotificationsRepository.markAsRead).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(
        makeNotification({ userId: 'other-user-uuid' })
      );

      await expect(service.markAsRead('notif-uuid', 'user-uuid'))
        .rejects.toThrow(ForbiddenException);

      await expect(service.markAsRead('notif-uuid', 'user-uuid'))
        .rejects.toThrow('Access denied');

      expect(mockNotificationsRepository.markAsRead).not.toHaveBeenCalled();
    });

  });

  // ── markAllAsRead() ──────────────────────────────────────────────────

  describe('markAllAsRead()', () => {

    it('should mark all notifications as read and return message', async () => {
      mockNotificationsRepository.markAllAsRead.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-uuid');

      expect(result).toEqual({ message: 'All notifications marked as read' });
      expect(mockNotificationsRepository.markAllAsRead)
        .toHaveBeenCalledWith('user-uuid');
    });

    it('should return success message even when no unread notifications', async () => {
      mockNotificationsRepository.markAllAsRead.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-uuid');

      expect(result).toEqual({ message: 'All notifications marked as read' });
    });

  });

  // ── remove() ─────────────────────────────────────────────────────────

  describe('remove()', () => {

    it('should delete notification when owner requests', async () => {
      const notification = makeNotification();
      mockNotificationsRepository.findById.mockResolvedValue(notification);
      mockNotificationsRepository.delete.mockResolvedValue(notification);

      const result = await service.remove('notif-uuid', 'user-uuid');

      expect(result).toEqual(notification);
      expect(mockNotificationsRepository.delete)
        .toHaveBeenCalledWith('notif-uuid');
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'user-uuid'))
        .rejects.toThrow(NotFoundException);

      await expect(service.remove('non-existent', 'user-uuid'))
        .rejects.toThrow('Notification not found');

      expect(mockNotificationsRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own notification', async () => {
      mockNotificationsRepository.findById.mockResolvedValue(
        makeNotification({ userId: 'other-user-uuid' })
      );

      await expect(service.remove('notif-uuid', 'user-uuid'))
        .rejects.toThrow(ForbiddenException);

      await expect(service.remove('notif-uuid', 'user-uuid'))
        .rejects.toThrow('Access denied');

      expect(mockNotificationsRepository.delete).not.toHaveBeenCalled();
    });

  });

  // ── broadcast() ──────────────────────────────────────────────────────

  describe('broadcast()', () => {

    it('should send to specific users when userIds provided', async () => {
      const dto = {
        userIds: ['user-1', 'user-2'],
        title: 'System maintenance',
        message: 'Server will be down at 2AM',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);

      const result = await service.broadcast(dto);

      expect(result).toEqual({ message: 'Notification sent to 2 user(s)' });
      expect(mockNotificationsRepository.createForUsers)
        .toHaveBeenCalledWith(dto);
      expect(mockNotificationsGateway.notifyUsers)
        .toHaveBeenCalledWith(['user-1', 'user-2'], dto);
      expect(mockNotificationsRepository.createForAllUsers).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should broadcast to all users when no userIds provided', async () => {
      const dto = {
        title: 'System update',
        message: 'New features released',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);

      const result = await service.broadcast(dto);

      expect(result).toEqual({ message: 'Notification broadcast to all users' });
      expect(mockNotificationsRepository.createForAllUsers)
        .toHaveBeenCalledWith(dto);
      expect(mockNotificationsGateway.notifyAll).toHaveBeenCalledWith(dto);
      expect(mockNotificationsRepository.createForUsers).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyUsers).not.toHaveBeenCalled();
    });

    it('should broadcast to all when userIds is empty array', async () => {
      const dto = {
        userIds: [],
        title: 'System update',
        message: 'New features released',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);

      const result = await service.broadcast(dto);

      expect(result).toEqual({ message: 'Notification broadcast to all users' });
      expect(mockNotificationsRepository.createForAllUsers).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyAll).toHaveBeenCalledTimes(1);
    });

    it('should return correct count message for single user', async () => {
      const dto = {
        userIds: ['user-1'],
        title: 'Personal notice',
        message: 'Your account was updated',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);

      const result = await service.broadcast(dto);

      expect(result).toEqual({ message: 'Notification sent to 1 user(s)' });
    });

  });

  // ── gateway methods ───────────────────────────────────────────────────

  describe('gateway integration', () => {

    it('should call notifyUsers with correct userIds on targeted broadcast', async () => {
      const dto = {
        userIds: ['user-1', 'user-2', 'user-3'],
        title: 'Update',
        message: 'Message',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);

      await service.broadcast(dto);

      const [calledUserIds, calledPayload] =
        mockNotificationsGateway.notifyUsers.mock.calls[0];
      expect(calledUserIds).toEqual(['user-1', 'user-2', 'user-3']);
      expect(calledPayload).toEqual(dto);
    });

    it('should call notifyAll with full dto on global broadcast', async () => {
      const dto = {
        title: 'Maintenance',
        message: 'Down for 1 hour',
        type: NotifEnum.SYSTEM_ANNOUNCEMENT,
      };
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);

      await service.broadcast(dto);

      const [calledPayload] = mockNotificationsGateway.notifyAll.mock.calls[0];
      expect(calledPayload).toEqual(dto);
    });

  });

});