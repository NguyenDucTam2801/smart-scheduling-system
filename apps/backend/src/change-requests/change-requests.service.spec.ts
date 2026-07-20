import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException
} from '@nestjs/common';
import { CrStatusEnum, NotifEnum, StatusEnum } from '@prisma/client';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsRepository } from './change-requests.repository';
import { SchedulesRepository } from '../schedules/schedules.repository';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { mockChangeRequestsRepository } from './__mocks__/change-requests.repository.mock';
import { mockSchedulesRepository } from '../schedules/__mocks__/schedules.repository.mock';
import { mockNotificationsRepository } from 'src/notifications/__mocks__/notifications.repository.mock';
import { mockNotificationsGateway } from 'src/notifications/__mocks__/notifications.gateway.mock';

import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';
import { mockTransactionManager } from 'src/transaction-manager/__mocks__/transaction-manager.mock';

// ── Helpers ──────────────────────────────────────────────────────────
const makeSchedule = (overrides = {}) => ({
  id: 'sched-uuid',
  title: 'English Class A1',
  userId: 'user-uuid',
  roomId: 'room-uuid',
  startTime: new Date('2026-06-30T08:00:00Z'),
  endTime: new Date('2026-06-30T10:00:00Z'),
  status: StatusEnum.APPROVED,
  version: 0,
  room: {
    id: 'room-uuid',
    name: 'Room A',
  },
  ...overrides,
});

const makeChangeRequest = (overrides = {}) => ({
  id: 'cr-uuid',
  scheduleId: 'sched-uuid',
  requesterId: 'user-uuid',
  newStart: new Date('2026-06-11T08:00:00Z'),
  newEnd: new Date('2026-06-11T10:00:00Z'),
  reason: 'Need to reschedule',
  status: CrStatusEnum.PENDING,
  reviewedBy: null,
  createdAt: new Date(),
  schedule: {
    id: 'sched-uuid',
    title: 'English Class A1',
    room: { id: 'room-uuid', name: 'Room A' },
  },
  ...overrides,
});

describe('ChangeRequestsService', () => {
  let service: ChangeRequestsService;

  beforeEach(async () => {
    mockTransactionManager.runInTransaction
      .mockImplementation((fn) => fn(undefined));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangeRequestsService,
        { provide: ChangeRequestsRepository, useValue: mockChangeRequestsRepository },
        { provide: SchedulesRepository, useValue: mockSchedulesRepository },
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: TransactionManager, useValue: mockTransactionManager },
      ],
    }).compile();

    service = module.get<ChangeRequestsService>(ChangeRequestsService);
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      scheduleId: 'sched-uuid',
      newStart: '2026-06-30T08:00:00Z',
      newEnd: '2026-06-30T10:00:00Z',
      reason: 'Need to reschedule',
    };
    const userId = 'user-uuid';

    it('should create change request and emit notification', async () => {
      const cr = makeChangeRequest();
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus.mockResolvedValue(null);
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockChangeRequestsRepository.create.mockResolvedValue(cr);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.create(dto, userId);

      expect(result).toEqual(cr);
      expect(mockChangeRequestsRepository.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ type: NotifEnum.REQUEST_SUBMITTED }),
      );
    });

    it('should create change request without time range', async () => {
      const dtoNoTime = { scheduleId: 'sched-uuid', reason: 'Cancel please' };
      const cr = makeChangeRequest({ newStart: null, newEnd: null });
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus.mockResolvedValue(null);
      mockChangeRequestsRepository.create.mockResolvedValue(cr);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.create(dtoNoTime, userId);

      expect(result).toBeDefined();
      // No overlap check when no times provided
      expect(mockSchedulesRepository.findOverlappingSchedules).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(null);

      await expect(service.create(dto, userId))
        .rejects.toThrow(NotFoundException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('Schedule not found');

      expect(mockChangeRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user does not own the schedule', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ userId: 'other-user-uuid' })
      );

      await expect(service.create(dto, userId))
        .rejects.toThrow(ForbiddenException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('You can only submit change requests for your own');

      expect(mockChangeRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when schedule is REJECTED', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(
        makeSchedule({ status: StatusEnum.REJECTED })
      );

      await expect(service.create(dto, userId))
        .rejects.toThrow(BadRequestException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('Cannot submit change request for rejected schedule');
    });

    it('should throw ConflictException when duplicate pending request exists', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus
        .mockResolvedValue(makeChangeRequest()); // existing pending

      await expect(service.create(dto, userId))
        .rejects.toThrow(ConflictException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('You already have a pending change request');

      expect(mockChangeRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when new time range is invalid', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus.mockResolvedValue(null);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(
        service.create(
          { ...dto, newStart: '2026-06-11T10:00:00Z', newEnd: '2026-06-11T08:00:00Z' },
          userId,
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockChangeRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when proposed time overlaps existing booking', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus.mockResolvedValue(null);
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(
        makeSchedule({ id: 'other-sched', title: 'Conflicting Class' })
      );
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(service.create(dto, userId))
        .rejects.toThrow(ConflictException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('The proposed time overlaps');

      expect(mockChangeRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails', async () => {
      mockSchedulesRepository.findById.mockResolvedValue(makeSchedule());
      mockChangeRequestsRepository.findRequestByScheduleWithStatus.mockResolvedValue(null);
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.create(dto, userId)).rejects.toThrow('DB error');
      expect(mockNotificationsGateway.notifyUser).not.toHaveBeenCalled();
    });
  });

  // ── findAllForUser() ─────────────────────────────────────────────────

  describe('findAllForUser()', () => {

    it('should return change requests for the requesting user', async () => {
      const requests = [makeChangeRequest()];
      mockChangeRequestsRepository.findMany.mockResolvedValue(requests);

      const result = await service.findAllForUser({}, 'user-uuid');

      expect(result).toEqual(requests);
      expect(mockChangeRequestsRepository.findMany).toHaveBeenCalledWith({}, 'user-uuid');
    });

    it('should return empty array when user has no change requests', async () => {
      mockChangeRequestsRepository.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser({}, 'user-uuid');
      expect(result).toHaveLength(0);
    });

    it('should filter by status when provided', async () => {
      const requests = [makeChangeRequest()];
      mockChangeRequestsRepository.findMany.mockResolvedValue(requests);

      const result = await service.findAllForUser(
        { status: CrStatusEnum.PENDING }, 'user-uuid'
      );

      expect(result).toEqual(requests);
      expect(mockChangeRequestsRepository.findMany).toHaveBeenCalledWith(
        { status: CrStatusEnum.PENDING }, 'user-uuid',
      );
    });

  });

  // ── findAllForAdmin() ────────────────────────────────────────────────

  describe('findAllForAdmin()', () => {

    it('should return all change requests for admin', async () => {
      const requests = [makeChangeRequest(), makeChangeRequest({ id: 'cr-2' })];
      mockChangeRequestsRepository.findMany.mockResolvedValue(requests);

      const result = await service.findAllForAdmin({});

      expect(result).toHaveLength(2);
      expect(mockChangeRequestsRepository.findMany).toHaveBeenCalledWith(
        {}, undefined,
      );
    });

    it('should filter by requesterId when provided', async () => {
      const requests = [makeChangeRequest()];
      mockChangeRequestsRepository.findMany.mockResolvedValue(requests);

      await service.findAllForAdmin({ requesterId: 'user-uuid' });

      expect(mockChangeRequestsRepository.findMany).toHaveBeenCalledWith(
        { requesterId: 'user-uuid' }, 'user-uuid',
      );
    });

  });

  // ── findOne() ────────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return change request when admin requests', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(
        makeChangeRequest({ requesterId: 'other-user' })
      );

      const result = await service.findOne('cr-uuid', 'admin-uuid', true);
      expect(result).toBeDefined();
    });

    it('should return change request when owner requests', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(makeChangeRequest());

      const result = await service.findOne('cr-uuid', 'user-uuid', false);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when change request does not exist', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-uuid', false))
        .rejects.toThrow(NotFoundException);

      await expect(service.findOne('non-existent', 'user-uuid', false))
        .rejects.toThrow('Change request not found');
    });

    it('should throw ForbiddenException when user requests another users change request', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(
        makeChangeRequest({ requesterId: 'other-user-uuid' })
      );

      await expect(service.findOne('cr-uuid', 'user-uuid', false))
        .rejects.toThrow(ForbiddenException);

      await expect(service.findOne('cr-uuid', 'user-uuid', false))
        .rejects.toThrow('Access denied');
    });

  });

  // ── review() — APPROVE ───────────────────────────────────────────────

  describe('review() — APPROVE', () => {
    const adminId = 'admin-uuid';
    const dto = { status: CrStatusEnum.APPROVED };

    it('should approve change request and update schedule times', async () => {
      const cr = makeChangeRequest();
      const approved = { ...cr, status: CrStatusEnum.APPROVED, reviewedBy: adminId };
      mockChangeRequestsRepository.findById.mockResolvedValue(cr);
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(null);
      mockChangeRequestsRepository.approveRequest.mockResolvedValue(approved);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.review('cr-uuid', dto, adminId);

      expect(result.status).toBe(CrStatusEnum.APPROVED);
      expect(mockChangeRequestsRepository.approveRequest).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyUsers).toHaveBeenCalledWith(
        expect.arrayContaining(['user-uuid', adminId]),
        expect.objectContaining({ type: NotifEnum.REQUEST_APPROVED }),
      );
    });

    it('should approve without conflict check when no new times provided', async () => {
      const cr = makeChangeRequest({ newStart: null, newEnd: null });
      mockChangeRequestsRepository.findById.mockResolvedValue(cr);
      mockChangeRequestsRepository.approveRequest.mockResolvedValue({
        ...cr, status: CrStatusEnum.APPROVED,
      });
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await service.review('cr-uuid', dto, adminId);

      expect(mockSchedulesRepository.findOverlappingSchedules).not.toHaveBeenCalled();
      expect(mockChangeRequestsRepository.approveRequest).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when change request does not exist', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(null);

      await expect(service.review('non-existent', dto, adminId))
        .rejects.toThrow(NotFoundException);

      await expect(service.review('non-existent', dto, adminId))
        .rejects.toThrow('Change request not found');
    });

    it('should throw ConflictException when new time slot conflicts', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(makeChangeRequest());
      mockSchedulesRepository.findOverlappingSchedules.mockResolvedValue(
        makeSchedule({ id: 'other-uuid', title: 'Conflicting Class' })
      );
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      await expect(service.review('cr-uuid', dto, adminId))
        .rejects.toThrow(ConflictException);

      await expect(service.review('cr-uuid', dto, adminId))
        .rejects.toThrow('New time slot conflicts');

      expect(mockChangeRequestsRepository.approveRequest).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails on approve', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(makeChangeRequest());
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.review('cr-uuid', dto, adminId))
        .rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyUsers).not.toHaveBeenCalled();
    });

  });

  // ── review() — REJECT ────────────────────────────────────────────────

  describe('review() — REJECT', () => {
    const adminId = 'admin-uuid';
    const dto = { status: CrStatusEnum.REJECTED };

    it('should reject change request and notify requester', async () => {
      const cr = makeChangeRequest();
      const rejected = { ...cr, status: CrStatusEnum.REJECTED, reviewedBy: adminId };
      mockChangeRequestsRepository.findById.mockResolvedValue(cr);
      mockChangeRequestsRepository.rejectRequest.mockResolvedValue(rejected);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction
        .mockImplementation(async (fn) => fn(undefined));

      const result = await service.review('cr-uuid', dto, adminId);

      expect(result.status).toBe(CrStatusEnum.REJECTED);
      expect(mockChangeRequestsRepository.rejectRequest).toHaveBeenCalledTimes(1);
      expect(mockSchedulesRepository.findOverlappingSchedules).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyUsers).toHaveBeenCalledWith(
        expect.arrayContaining(['user-uuid', adminId]),
        expect.objectContaining({ type: NotifEnum.REQUEST_REJECTED }),
      );
    });

    it('should throw NotFoundException when change request does not exist', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(null);

      await expect(service.review('non-existent', dto, adminId))
        .rejects.toThrow(NotFoundException);
    });

    it('should not emit notification when transaction fails on reject', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(makeChangeRequest());
      mockTransactionManager.runInTransaction
        .mockRejectedValue(new Error('DB error'));

      await expect(service.review('cr-uuid', dto, adminId))
        .rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyUsers).not.toHaveBeenCalled();
    });

  });

  // ── review() — invalid status ────────────────────────────────────────

  describe('review() — invalid status', () => {

    it('should throw BadRequestException for invalid status', async () => {
      mockChangeRequestsRepository.findById.mockResolvedValue(makeChangeRequest());

      await expect(
        service.review('cr-uuid', { status: 'INVALID' as any }, 'admin-uuid')
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.review('cr-uuid', { status: 'INVALID' as any }, 'admin-uuid')
      ).rejects.toThrow('Invalid status provided for review');
    });

  });

});