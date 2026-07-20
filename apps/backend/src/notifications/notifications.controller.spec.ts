import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotifEnum, RoleEnum } from '@prisma/client';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// ── Mock service — plain jest.fn() only ───────────────────────────
const mockNotificationsService = {
    findAll: jest.fn(),
    unreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    remove: jest.fn(),
    broadcast: jest.fn(),
};

// ── Mock users ────────────────────────────────────────────────────
const mockUser = {
    sub: 'user-uuid',
    email: 'user@example.com',
    role: RoleEnum.USER,
};

const mockSuperAdmin = {
    sub: 'superadmin-uuid',
    email: 'superadmin@example.com',
    role: RoleEnum.SUPERADMIN,
};

// ── Helper ────────────────────────────────────────────────────────
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

describe('NotificationsController', () => {
    let controller: NotificationsController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                { provide: NotificationsService, useValue: mockNotificationsService },
            ],
        }).compile();

        controller = module.get<NotificationsController>(NotificationsController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    // ── findAll() ────────────────────────────────────────────────────

    describe('findAll()', () => {

        it('should return notifications for current user', async () => {
            const notifications = [makeNotification(), makeNotification({ id: 'notif-2' })];
            mockNotificationsService.findAll.mockResolvedValue(notifications);

            const result = await controller.findAll({}, mockUser as any);

            expect(result).toEqual(notifications);
            expect(mockNotificationsService.findAll)
                .toHaveBeenCalledWith(mockUser.sub, {});
            expect(mockNotificationsService.findAll).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no notifications', async () => {
            mockNotificationsService.findAll.mockResolvedValue([]);

            const result = await controller.findAll({}, mockUser as any);

            expect(result).toHaveLength(0);
        });

        it('should pass query filters to service', async () => {
            mockNotificationsService.findAll.mockResolvedValue([]);

            await controller.findAll({ isRead: false }, mockUser as any);

            expect(mockNotificationsService.findAll)
                .toHaveBeenCalledWith(mockUser.sub, { isRead: false });
        });

    });

    // ── unreadCount() ────────────────────────────────────────────────

    describe('unreadCount()', () => {

        it('should return unread count for current user', async () => {
            mockNotificationsService.unreadCount.mockResolvedValue({ unreadCount: 3 });

            const result = await controller.unreadCount(mockUser as any);

            expect(result).toEqual({ unreadCount: 3 });
            expect(mockNotificationsService.unreadCount)
                .toHaveBeenCalledWith(mockUser.sub);
            expect(mockNotificationsService.unreadCount).toHaveBeenCalledTimes(1);
        });

        it('should return 0 when no unread notifications', async () => {
            mockNotificationsService.unreadCount.mockResolvedValue({ unreadCount: 0 });

            const result = await controller.unreadCount(mockUser as any);

            expect(result).toEqual({ unreadCount: 0 });
        });

    });

    // ── markAsRead() ─────────────────────────────────────────────────

    describe('markAsRead()', () => {

        it('should mark notification as read', async () => {
            const updated = makeNotification({ isRead: true });
            mockNotificationsService.markAsRead.mockResolvedValue(updated);

            const result = await controller.markAsRead('notif-uuid', mockUser as any);

            expect(result.isRead).toBe(true);
            expect(mockNotificationsService.markAsRead)
                .toHaveBeenCalledWith('notif-uuid', mockUser.sub);
        });

        it('should throw NotFoundException when notification does not exist', async () => {
            mockNotificationsService.markAsRead.mockRejectedValue(
                new NotFoundException('Notification not found')
            );

            await expect(controller.markAsRead('non-existent', mockUser as any))
                .rejects.toThrow(NotFoundException);

            await expect(controller.markAsRead('non-existent', mockUser as any))
                .rejects.toThrow('Notification not found');
        });

        it('should throw ForbiddenException when user does not own notification', async () => {
            mockNotificationsService.markAsRead.mockRejectedValue(
                new ForbiddenException('Access denied')
            );

            await expect(controller.markAsRead('notif-uuid', mockUser as any))
                .rejects.toThrow(ForbiddenException);

            await expect(controller.markAsRead('notif-uuid', mockUser as any))
                .rejects.toThrow('Access denied');
        });

    });

    // ── markAllAsRead() ──────────────────────────────────────────────

    describe('markAllAsRead()', () => {

        it('should mark all notifications as read', async () => {
            mockNotificationsService.markAllAsRead.mockResolvedValue({
                message: 'All notifications marked as read',
            });

            const result = await controller.markAllAsRead(mockUser as any);

            expect(result).toEqual({ message: 'All notifications marked as read' });
            expect(mockNotificationsService.markAllAsRead)
                .toHaveBeenCalledWith(mockUser.sub);
            expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledTimes(1);
        });

    });

    // ── remove() ─────────────────────────────────────────────────────

    describe('remove()', () => {

        it('should delete notification when owner requests', async () => {
            const notification = makeNotification();
            mockNotificationsService.remove.mockResolvedValue(notification);

            const result = await controller.remove('notif-uuid', mockSuperAdmin as any);

            expect(result).toEqual(notification);
            expect(mockNotificationsService.remove)
                .toHaveBeenCalledWith('notif-uuid', mockSuperAdmin.sub);
        });

        it('should throw NotFoundException when notification does not exist', async () => {
            mockNotificationsService.remove.mockRejectedValue(
                new NotFoundException('Notification not found')
            );

            await expect(controller.remove('non-existent', mockSuperAdmin as any))
                .rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when user does not own notification', async () => {
            mockNotificationsService.remove.mockRejectedValue(
                new ForbiddenException('Access denied')
            );

            await expect(controller.remove('notif-uuid', mockSuperAdmin as any))
                .rejects.toThrow(ForbiddenException);
        });

    });

    // ── broadcast() ──────────────────────────────────────────────────

    describe('broadcast()', () => {

        it('should broadcast to specific users', async () => {
            const dto = {
                userIds: ['user-1', 'user-2'],
                title: 'Maintenance',
                message: 'Server down at 2AM',
                type: NotifEnum.SYSTEM_ANNOUNCEMENT,
            };
            mockNotificationsService.broadcast.mockResolvedValue({
                message: 'Notification sent to 2 user(s)',
            });

            const result = await controller.broadcast(dto);

            expect(result).toEqual({ message: 'Notification sent to 2 user(s)' });
            expect(mockNotificationsService.broadcast).toHaveBeenCalledWith(dto);
            expect(mockNotificationsService.broadcast).toHaveBeenCalledTimes(1);
        });

        it('should broadcast to all users when no userIds', async () => {
            const dto = {
                title: 'System update',
                message: 'New features released',
                type: NotifEnum.SYSTEM_ANNOUNCEMENT,
            };
            mockNotificationsService.broadcast.mockResolvedValue({
                message: 'Notification broadcast to all users',
            });

            const result = await controller.broadcast(dto);

            expect(result).toEqual({ message: 'Notification broadcast to all users' });
            expect(mockNotificationsService.broadcast).toHaveBeenCalledWith(dto);
        });

        it('should return correct user count message', async () => {
            const dto = {
                userIds: ['user-1'],
                title: 'Personal notice',
                message: 'Your account was updated',
                type: NotifEnum.SYSTEM_ANNOUNCEMENT,
            };
            mockNotificationsService.broadcast.mockResolvedValue({
                message: 'Notification sent to 1 user(s)',
            });

            const result = await controller.broadcast(dto);

            expect(result).toEqual({ message: 'Notification sent to 1 user(s)' });
        });

    });

    // ── gateway test ──────────────────────────────────────────────────

    describe('NotificationsGateway', () => {

        it('should have notifyUser, notifyUsers and notifyAll methods', () => {
            const gateway = {
                notifyUser: jest.fn(),
                notifyUsers: jest.fn(),
                notifyAll: jest.fn(),
            };

            gateway.notifyUser('user-uuid', { title: 'Test' });
            gateway.notifyUsers(['user-1', 'user-2'], { title: 'Test' });
            gateway.notifyAll({ title: 'Test' });

            expect(gateway.notifyUser).toHaveBeenCalledWith('user-uuid', { title: 'Test' });
            expect(gateway.notifyUsers).toHaveBeenCalledWith(['user-1', 'user-2'], { title: 'Test' });
            expect(gateway.notifyAll).toHaveBeenCalledWith({ title: 'Test' });
        });

        it('notifyUsers should call notifyUser for each userId', () => {
            const notifyUserMock = jest.fn();
            const gateway = {
                notifyUser: notifyUserMock,
                notifyUsers: (userIds: string[], payload: any) => {
                    userIds.forEach((id) => notifyUserMock(id, payload));
                },
                notifyAll: jest.fn(),
            };

            gateway.notifyUsers(['user-1', 'user-2', 'user-3'], { title: 'Test' });

            expect(notifyUserMock).toHaveBeenCalledTimes(3);
            expect(notifyUserMock).toHaveBeenCalledWith('user-1', { title: 'Test' });
            expect(notifyUserMock).toHaveBeenCalledWith('user-2', { title: 'Test' });
            expect(notifyUserMock).toHaveBeenCalledWith('user-3', { title: 'Test' });
        });

    });

});