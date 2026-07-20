import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException
} from '@nestjs/common';
import { RoleEnum, StatusEnum } from '@prisma/client';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

// ── Mock service ──────────────────────────────────────────────────
const mockSchedulesService = {
  create: jest.fn(),
  findAllForUser: jest.fn(),
  findAllForAdmin: jest.fn(),
  findOne: jest.fn(),
  updateForUser: jest.fn(),
  updateForAdmin: jest.fn(),
  delete: jest.fn(),
};

// ── Mock users ────────────────────────────────────────────────────
const mockUser = { sub: 'user-uuid', email: 'user@example.com', role: RoleEnum.USER };
const mockAdminUser = { sub: 'admin-uuid', email: 'admin@example.com', role: RoleEnum.ADMIN };

const makeSchedule = (overrides = {}) => ({
  id: 'sched-uuid',
  title: 'English Class A1',
  userId: 'user-uuid',
  roomId: 'room-uuid',
  startTime: new Date('2026-06-10T08:00:00Z'),
  endTime: new Date('2026-06-10T10:00:00Z'),
  status: StatusEnum.APPROVED,
  version: 0,
  ...overrides,
});

describe('SchedulesController', () => {
  let controller: SchedulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [
        { provide: SchedulesService, useValue: mockSchedulesService },
      ],
    }).compile();

    controller = module.get<SchedulesController>(SchedulesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create() ──────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      title: 'English Class A1',
      roomId: 'room-uuid',
      startTime: '2026-06-10T08:00:00Z',
      endTime: '2026-06-10T10:00:00Z',
    };

    it('should create and return schedule', async () => {
      const schedule = makeSchedule();
      mockSchedulesService.create.mockResolvedValue(schedule);

      const result = await controller.create(dto, mockUser as any);

      expect(result).toEqual(schedule);
      expect(mockSchedulesService.create).toHaveBeenCalledWith(dto, mockUser.sub);
    });

    it('should throw when time range is invalid', async () => {
      mockSchedulesService.create.mockRejectedValue(
        new BadRequestException('Invalid time range')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when room is booked', async () => {
      mockSchedulesService.create.mockRejectedValue(
        new ConflictException('Room is already booked')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(ConflictException);
    });
  });

  // ── findAll() ────────────────────────────────────────────────────

  describe('findAll()', () => {

    it('should return own schedules for user', async () => {
      const schedules = [makeSchedule()];
      mockSchedulesService.findAllForUser.mockResolvedValue(schedules);

      const result = await controller.findAll({}, mockUser as any);

      expect(result).toEqual(schedules);
      expect(mockSchedulesService.findAllForUser).toHaveBeenCalledWith({}, mockUser.sub);
    });

    it('should return empty array when user has no schedules', async () => {
      mockSchedulesService.findAllForUser.mockResolvedValue([]);

      const result = await controller.findAll({}, mockUser as any);
      expect(result).toHaveLength(0);
    });

  });

  // ── findAllForAdmin() ─────────────────────────────────────────────

  describe('findAllForAdmin()', () => {

    it('should return all schedules for admin', async () => {
      const schedules = [makeSchedule(), makeSchedule({ id: 'sched-2' })];
      mockSchedulesService.findAllForAdmin.mockResolvedValue(schedules);

      const result = await controller.findAllForAdmin({});

      expect(result).toHaveLength(2);
      expect(mockSchedulesService.findAllForAdmin).toHaveBeenCalledWith({});
    });

  });

  // ── findOne() ────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return schedule for user requesting own', async () => {
      const schedule = makeSchedule();
      mockSchedulesService.findOne.mockResolvedValue(schedule);

      const result = await controller.findOne('sched-uuid', mockUser as any);

      expect(result).toEqual(schedule);
      expect(mockSchedulesService.findOne).toHaveBeenCalledWith(
        'sched-uuid', mockUser.sub, false,
      );
    });

    it('should pass isAdmin=true when admin requests', async () => {
      mockSchedulesService.findOne.mockResolvedValue(makeSchedule());

      await controller.findOne('sched-uuid', mockAdminUser as any);

      expect(mockSchedulesService.findOne).toHaveBeenCalledWith(
        'sched-uuid', mockAdminUser.sub, true,
      );
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesService.findOne.mockRejectedValue(
        new NotFoundException('Schedule not found')
      );

      await expect(controller.findOne('non-existent', mockUser as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user requests another users schedule', async () => {
      mockSchedulesService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied')
      );

      await expect(controller.findOne('sched-uuid', mockUser as any))
        .rejects.toThrow(ForbiddenException);
    });

  });

  // ── updateStatusForUser() ─────────────────────────────────────────

  describe('updateStatusForUser()', () => {
    const dto = { status: StatusEnum.CANCELLED, version: 0 };

    it('should cancel own schedule', async () => {
      const updated = makeSchedule({ status: StatusEnum.CANCELLED });
      mockSchedulesService.updateForUser.mockResolvedValue(updated);

      const result = await controller.updateStatusForUser(
        'sched-uuid', dto, mockUser as any
      );
      if (!result) throw new Error('Expected result to be defined');

      expect(result.status).toBe(StatusEnum.CANCELLED);
      expect(mockSchedulesService.updateForUser).toHaveBeenCalledWith(
        'sched-uuid', dto, mockUser.sub,
      );
    });

    it('should throw ForbiddenException when user tries to APPROVE', async () => {
      mockSchedulesService.updateForUser.mockRejectedValue(
        new ForbiddenException('You can only cancel your own schedule')
      );

      await expect(
        controller.updateStatusForUser('sched-uuid', dto, mockUser as any)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when version is invalid', async () => {
      mockSchedulesService.updateForUser.mockRejectedValue(
        new BadRequestException('version is invalid')
      );

      await expect(
        controller.updateStatusForUser('sched-uuid', dto, mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when already cancelled', async () => {
      mockSchedulesService.updateForUser.mockRejectedValue(
        new ConflictException('Schedule is already cancelled')
      );

      await expect(
        controller.updateStatusForUser('sched-uuid', dto, mockUser as any)
      ).rejects.toThrow(ConflictException);
    });

  });

  // ── updateStatusForAdmin() ────────────────────────────────────────

  describe('updateStatusForAdmin()', () => {
    const dto = { status: StatusEnum.APPROVED, version: 0 };

    it('should approve schedule', async () => {
      const updated = makeSchedule({ status: StatusEnum.APPROVED, version: 1 });
      mockSchedulesService.updateForAdmin.mockResolvedValue(updated);

      const result = await controller.updateStatusForAdmin(
        'sched-uuid', dto, mockAdminUser as any
      );
      if (!result) throw new Error('Expected result to be defined');
      expect(result.status).toBe(StatusEnum.APPROVED);
      expect(mockSchedulesService.updateForAdmin).toHaveBeenCalledWith(
        'sched-uuid', dto, mockAdminUser.sub,
      );
    });

    it('should throw ConflictException when stale version', async () => {
      mockSchedulesService.updateForAdmin.mockRejectedValue(
        new ConflictException('modified by another user')
      );

      await expect(
        controller.updateStatusForAdmin('sched-uuid', dto, mockAdminUser as any)
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when invalid status for admin', async () => {
      mockSchedulesService.updateForAdmin.mockRejectedValue(
        new BadRequestException('Admin can just restore approve or reject a schedule')
      );

      await expect(
        controller.updateStatusForAdmin('sched-uuid', dto, mockAdminUser as any)
      ).rejects.toThrow(BadRequestException);
    });

  });

  // ── hardCancel() ──────────────────────────────────────────────────

  describe('hardCancel()', () => {

    it('should hard delete a cancelled schedule', async () => {
      const deleted = makeSchedule({ status: StatusEnum.CANCELLED });
      mockSchedulesService.delete.mockResolvedValue(deleted);

      const result = await controller.hardCancel('sched-uuid', mockAdminUser as any);

      expect(result).toEqual(deleted);
      expect(mockSchedulesService.delete).toHaveBeenCalledWith(
        'sched-uuid', mockAdminUser.sub,
      );
    });

    it('should throw ConflictException when schedule is not CANCELLED', async () => {
      mockSchedulesService.delete.mockRejectedValue(
        new ConflictException('Only cancelled schedules can be deleted')
      );

      await expect(
        controller.hardCancel('sched-uuid', mockAdminUser as any)
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when schedule does not exist', async () => {
      mockSchedulesService.delete.mockRejectedValue(
        new NotFoundException('This schedule does not exist')
      );

      await expect(
        controller.hardCancel('non-existent', mockAdminUser as any)
      ).rejects.toThrow(NotFoundException);
    });

  });

});