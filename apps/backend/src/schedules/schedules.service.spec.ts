import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException
} from '@nestjs/common';
import { NotifEnum, StatusEnum } from '@prisma/client';
import { SchedulesService } from './schedules.service';
import { SchedulesRepository } from './schedules.repository';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { mockSchedulesRepository } from './__mocks__/schedules.repository.mock';
import { mockNotificationsRepository } from 'src/notifications/__mocks__/notifications.repository.mock';
import { mockNotificationsGateway } from 'src/notifications/__mocks__/notifications.gateway.mock';
import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';
import { mockTransactionManager } from 'src/transaction-manager/__mocks__/transaction-manager.mock';


// ── Helpers ─────────────────────────────────────────────────────────
const makeSchedule = (overrides = {}) => ({
  id: 'sched-uuid',
  title: 'English Class A1',
  userId: 'user-uuid',
  roomId: 'room-uuid',
  startTime: new Date('2026-06-30T08:00:00Z'),
  endTime: new Date('2026-06-30T10:00:00Z'),
  status: StatusEnum.APPROVED,
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SchedulesService', () => {
  let service: SchedulesService;

  beforeEach(async () => {
    mockTransactionManager.runInTransaction
      .mockImplementation((fn) => fn(undefined));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: SchedulesRepository, useValue: mockSchedulesRepository },
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: TransactionManager, useValue: mockTransactionManager },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    jest.clearAllMocks();
  });

  // ── create() ──────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      title: 'English Class A1',
      roomId: 'room-uuid',
      startTime: '2026-06-30T08:00:00Z',
      endTime: '2026-06-30T10:00:00Z',
    };
    const userId = 'user-uuid';

    it('should create schedule and emit notification when no conflict', async () => {
      const schedule = makeSchedule();
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockSchedulesRepository.create.mockResolvedValue(schedule);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.create(dto, userId);

      expect(result).toEqual(schedule);
      expect(mockSchedulesRepository.findOverlappingSchedules).toHaveBeenCalledTimes(1);
      expect(mockSchedulesRepository.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ type: NotifEnum.SCHEDULE_CREATED }),
      );
    });

    it('should throw BadRequestException when time range is invalid', async () => {
      await expect(
        service.create({ ...dto, startTime: '2026-06-30T10:00:00Z', endTime: '2026-06-30T08:00:00Z' }, userId)
      ).rejects.toThrow(BadRequestException);

      expect(mockSchedulesRepository.findOverlappingSchedules).not.toHaveBeenCalled();
      expect(mockSchedulesRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when startTime equals endTime', async () => {
      await expect(
        service.create({ ...dto, startTime: '2026-06-10T08:00:00Z', endTime: '2026-06-10T08:00:00Z' }, userId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when room is already booked', async () => {
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(
        makeSchedule({ startTime: new Date('2026-06-10T09:00:00Z'), endTime: new Date('2026-06-10T11:00:00Z') })
      );
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(service.create(dto, userId))
        .rejects.toThrow(ConflictException);

      expect(mockSchedulesRepository.create).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyUser).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails', async () => {
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.create(dto, userId)).rejects.toThrow('DB error');
      expect(mockNotificationsGateway.notifyUser).not.toHaveBeenCalled();
    });

    it('should pass correct notification payload', async () => {
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockSchedulesRepository.create.mockResolvedValue(makeSchedule());
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await service.create(dto, userId);

      const [calledUserId, payload] = mockNotificationsGateway.notifyUser.mock.calls[0];
      expect(calledUserId).toBe(userId);
      expect(payload.title).toBe('New schedule created');
      expect(payload.message).toContain(dto.title);
    });
  });

  // ── findAllForUser() ──────────────────────────────────────────────

  describe('findAllForUser()', () => {

    it('should return schedules for the requesting user', async () => {
      const schedules = [makeSchedule()];
      mockSchedulesRepository.findMany.mockResolvedValue(schedules);

      const result = await service.findAllForUser({}, 'user-uuid');

      expect(result).toEqual(schedules);
      expect(mockSchedulesRepository.findMany).toHaveBeenCalledWith(
        expect.any(Object),
        'user-uuid',
      );
    });

    it('should return empty array when user has no schedules', async () => {
      mockSchedulesRepository.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser({}, 'user-uuid');
      expect(result).toHaveLength(0);
    });

  });

  // ── findAllForAdmin() ─────────────────────────────────────────────

  describe('findAllForAdmin()', () => {

    it('should return all schedules for admin', async () => {
      const schedules = [makeSchedule(), makeSchedule({ id: 'sched-2' })];
      mockSchedulesRepository.findMany.mockResolvedValue(schedules);

      const result = await service.findAllForAdmin({});

      expect(result).toHaveLength(2);
      // Admin call has no userId filter
      expect(mockSchedulesRepository.findMany).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
      );
    });

  });

  // ── findOne() ────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return schedule when admin requests any schedule', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ userId: 'other-user' })
      );

      const result = await service.findOne('sched-uuid', 'admin-uuid', true);
      expect(result).toBeDefined();
    });

    it('should return schedule when user requests own schedule', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());

      const result = await service.findOne('sched-uuid', 'user-uuid', false);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-uuid', false))
        .rejects.toThrow(NotFoundException);

      await expect(service.findOne('non-existent', 'user-uuid', false))
        .rejects.toThrow('Schedule not found');
    });

    it('should throw ForbiddenException when user requests another users schedule', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ userId: 'other-user-uuid' })
      );

      await expect(service.findOne('sched-uuid', 'user-uuid', false))
        .rejects.toThrow(ForbiddenException);

      await expect(service.findOne('sched-uuid', 'user-uuid', false))
        .rejects.toThrow('Access denied');
    });

  });

  // ── updateForAdmin() ──────────────────────────────────────────────

  describe('updateForAdmin()', () => {
    const dto = {
      status: StatusEnum.APPROVED,
      version: 0,
    };
    const adminId = 'admin-uuid';

    it('should approve schedule when version matches and no conflict', async () => {
      const schedule = makeSchedule();
      const updated = makeSchedule({ status: StatusEnum.APPROVED, version: 1 });
      mockSchedulesRepository.findById
        .mockResolvedValueOnce(schedule)   // initial check
        .mockResolvedValueOnce(updated);   // after update
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockSchedulesRepository.updateForAdminWithLock.mockResolvedValue(1);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.updateForAdmin('sched-uuid', dto, adminId);
      if (!result) throw new Error('Expected result to be defined');

      expect(result.status).toBe(StatusEnum.APPROVED);
      expect(mockSchedulesRepository.updateForAdminWithLock).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUsers).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(null);

      await expect(service.updateForAdmin('non-existent', dto, adminId))
        .rejects.toThrow(NotFoundException);

      expect(mockSchedulesRepository.updateForAdminWithLock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when schedule is CANCELLED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.CANCELLED })
      );

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow(ConflictException);

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow('Cannot Update a cancelled or rejected schedule');
    });

    it('should throw ConflictException when schedule is REJECTED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.REJECTED })
      );

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when status is not APPROVED or REJECTED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());

      await expect(
        service.updateForAdmin('sched-uuid', { ...dto, status: StatusEnum.CANCELLED }, adminId)
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateForAdmin('sched-uuid', { ...dto, status: StatusEnum.CANCELLED }, adminId)
      ).rejects.toThrow('Admin can just restore approve or reject a schedule');
    });

    it('should throw BadRequestException when version is invalid', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ version: 2 })  // DB version is 2
      );

      await expect(
        service.updateForAdmin('sched-uuid', { ...dto, version: 0 }, adminId) // wrong version
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateForAdmin('sched-uuid', { ...dto, version: 0 }, adminId)
      ).rejects.toThrow('version is invalid');
    });

    it('should throw ConflictException when time overlap detected', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(
        makeSchedule({ id: 'other-uuid' })
      );
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow(ConflictException);

      expect(mockSchedulesRepository.updateForAdminWithLock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when optimistic lock fails (0 rows updated)', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockSchedulesRepository.updateForAdminWithLock.mockResolvedValue(0); // stale
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow(ConflictException);

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow('modified by another user');
    });

    it('should not emit notification when transaction fails', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.updateForAdmin('sched-uuid', dto, adminId))
        .rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyUsers).not.toHaveBeenCalled();
    });

  });

  // ── updateForUser() ───────────────────────────────────────────────

  describe('updateForUser()', () => {
    const dto = { status: StatusEnum.CANCELLED, version: 0 };

    it('should cancel own schedule successfully', async () => {
      const schedule = makeSchedule();
      const updated = makeSchedule({ status: StatusEnum.CANCELLED, version: 1 });
      mockSchedulesRepository.findById
        .mockResolvedValueOnce(schedule)
        .mockResolvedValueOnce(updated);
      mockSchedulesRepository.updateForUserWithLock.mockResolvedValue(1);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.updateForUser('sched-uuid', dto, 'user-uuid');
      if (!result) throw new Error('Expected result to be defined');

      expect(result.status).toBe(StatusEnum.CANCELLED);
      expect(mockSchedulesRepository.updateForUserWithLock).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUser).toHaveBeenCalledWith(
        'user-uuid',
        expect.objectContaining({ title: 'Existed schedule updated' }),
      );
    });

    it('should update title of own schedule', async () => {
      const schedule = makeSchedule();
      const updated = makeSchedule({ title: 'Updated Title' });
      mockSchedulesRepository.findById
        .mockResolvedValueOnce(schedule)
        .mockResolvedValueOnce(updated);
      mockSchedulesRepository.updateForUserWithLock.mockResolvedValue(1);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.updateForUser(
        'sched-uuid',
        { title: 'Updated Title', version: 0 },
        'user-uuid',
      );
      if (!result) throw new Error('Expected result to be defined');
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateForUser('non-existent', dto, 'user-uuid')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own schedule', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ userId: 'other-user-uuid' })
      );

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow('Access denied');
    });

    it('should throw ConflictException when schedule is already CANCELLED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.CANCELLED })
      );

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow(ConflictException);

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow('Schedule is already cancelled');
    });

    it('should throw ForbiddenException when user tries to set status other than CANCELLED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());

      await expect(
        service.updateForUser(
          'sched-uuid',
          { status: StatusEnum.APPROVED, version: 0 },
          'user-uuid',
        )
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateForUser(
          'sched-uuid',
          { status: StatusEnum.APPROVED, version: 0 },
          'user-uuid',
        )
      ).rejects.toThrow('You can only cancel your own schedule');
    });

    it('should throw BadRequestException when version is invalid', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ version: 3 })  // DB version is 3
      );

      await expect(
        service.updateForUser('sched-uuid', { ...dto, version: 0 }, 'user-uuid')
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateForUser('sched-uuid', { ...dto, version: 0 }, 'user-uuid')
      ).rejects.toThrow('version is invalid');
    });

    it('should throw ConflictException when optimistic lock fails', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockSchedulesRepository.updateForUserWithLock.mockResolvedValue(0); // stale
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow(ConflictException);
    });

    it('should not emit notification when transaction fails', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateForUser('sched-uuid', dto, 'user-uuid')
      ).rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyUser).not.toHaveBeenCalled();
    });

  });

  // ── delete() ─────────────────────────────────────────────────────

  describe('delete()', () => {
    const adminId = 'admin-uuid';

    it('should hard delete a cancelled schedule', async () => {
      const schedule = makeSchedule({ status: StatusEnum.CANCELLED });
      mockSchedulesRepository.findById.mockResolvedValue(schedule);
      mockSchedulesRepository.delete.mockResolvedValue(schedule);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.delete('sched-uuid', adminId);

      expect(result).toEqual(schedule);
      expect(mockSchedulesRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUsers).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent', adminId))
        .rejects.toThrow(NotFoundException);

      await expect(service.delete('non-existent', adminId))
        .rejects.toThrow('This schedule does not exist');

      expect(mockSchedulesRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when schedule is not CANCELLED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.APPROVED })
      );

      await expect(service.delete('sched-uuid', adminId))
        .rejects.toThrow(ConflictException);

      await expect(service.delete('sched-uuid', adminId))
        .rejects.toThrow('Only cancelled schedules can be deleted');

      expect(mockSchedulesRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when schedule is PENDING', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.APPROVED })
      );

      await expect(service.delete('sched-uuid', adminId))
        .rejects.toThrow(ConflictException);
    });

    it('should not emit notification when transaction fails', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.CANCELLED })
      );
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.delete('sched-uuid', adminId))
        .rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyUsers).not.toHaveBeenCalled();
    });

    it('should notify both schedule owner and admin after delete', async () => {
      const schedule = makeSchedule({ status: StatusEnum.CANCELLED, userId: 'user-uuid' });
      mockSchedulesRepository.findById.mockResolvedValue(schedule);
      mockSchedulesRepository.delete.mockResolvedValue(schedule);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await service.delete('sched-uuid', adminId);

      const [notifiedUsers] = mockNotificationsGateway.notifyUsers.mock.calls[0];
      expect(notifiedUsers).toContain('user-uuid');
      expect(notifiedUsers).toContain(adminId);
    });

  });

});