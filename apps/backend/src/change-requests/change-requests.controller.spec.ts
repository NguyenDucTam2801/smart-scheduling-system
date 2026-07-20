import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException
} from '@nestjs/common';
import { CrStatusEnum, RoleEnum } from '@prisma/client';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

// ── Mock service ──────────────────────────────────────────────────────
const mockChangeRequestsService = {
  create: jest.fn(),
  findAllForUser: jest.fn(),
  findAllForAdmin: jest.fn(),
  findOne: jest.fn(),
  review: jest.fn(),
};

// ── Mock users ─────────────────────────────────────────────────────────
const mockUser = { sub: 'user-uuid', email: 'user@example.com', role: RoleEnum.USER };
const mockAdminUser = { sub: 'admin-uuid', email: 'admin@example.com', role: RoleEnum.ADMIN };

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
  ...overrides,
});

describe('ChangeRequestsController', () => {
  let controller: ChangeRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeRequestsController],
      providers: [
        { provide: ChangeRequestsService, useValue: mockChangeRequestsService },
      ],
    }).compile();

    controller = module.get<ChangeRequestsController>(ChangeRequestsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create() ──────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      scheduleId: 'sched-uuid',
      newStart: '2026-06-11T08:00:00Z',
      newEnd: '2026-06-11T10:00:00Z',
      reason: 'Need to reschedule',
    };

    it('should create and return change request', async () => {
      const cr = makeChangeRequest();
      mockChangeRequestsService.create.mockResolvedValue(cr);

      const result = await controller.create(dto, mockUser as any);

      expect(result).toEqual(cr);
      expect(mockChangeRequestsService.create).toHaveBeenCalledWith(dto, mockUser.sub);
    });

    it('should throw NotFoundException when schedule not found', async () => {
      mockChangeRequestsService.create.mockRejectedValue(
        new NotFoundException('Schedule not found')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own schedule', async () => {
      mockChangeRequestsService.create.mockRejectedValue(
        new ForbiddenException('You can only submit change requests for your own')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when duplicate pending request exists', async () => {
      mockChangeRequestsService.create.mockRejectedValue(
        new ConflictException('You already have a pending change request')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when proposed time overlaps', async () => {
      mockChangeRequestsService.create.mockRejectedValue(
        new ConflictException('The proposed time overlaps')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(ConflictException);
    });
  });

  // ── findAllForUser() ──────────────────────────────────────────────────

  describe('findAllForUser()', () => {

    it('should return own change requests', async () => {
      const requests = [makeChangeRequest()];
      mockChangeRequestsService.findAllForUser.mockResolvedValue(requests);

      const result = await controller.findAllForUser({}, mockUser as any);

      expect(result).toEqual(requests);
      expect(mockChangeRequestsService.findAllForUser)
        .toHaveBeenCalledWith({}, mockUser.sub);
    });

    it('should return empty array when no change requests', async () => {
      mockChangeRequestsService.findAllForUser.mockResolvedValue([]);

      const result = await controller.findAllForUser({}, mockUser as any);
      expect(result).toHaveLength(0);
    });

    it('should filter by status', async () => {
      const requests = [makeChangeRequest()];
      mockChangeRequestsService.findAllForUser.mockResolvedValue(requests);

      await controller.findAllForUser(
        { status: CrStatusEnum.PENDING }, mockUser as any
      );

      expect(mockChangeRequestsService.findAllForUser).toHaveBeenCalledWith(
        { status: CrStatusEnum.PENDING }, mockUser.sub,
      );
    });

  });

  // ── findAllForAdmin() ─────────────────────────────────────────────────

  describe('findAllForAdmin()', () => {

    it('should return all change requests', async () => {
      const requests = [makeChangeRequest(), makeChangeRequest({ id: 'cr-2' })];
      mockChangeRequestsService.findAllForAdmin.mockResolvedValue(requests);

      const result = await controller.findAllForAdmin({});

      expect(result).toHaveLength(2);
      expect(mockChangeRequestsService.findAllForAdmin).toHaveBeenCalledWith({});
    });

    it('should filter by requesterId', async () => {
      mockChangeRequestsService.findAllForAdmin.mockResolvedValue([makeChangeRequest()]);

      await controller.findAllForAdmin({ requesterId: 'user-uuid' });

      expect(mockChangeRequestsService.findAllForAdmin).toHaveBeenCalledWith({
        requesterId: 'user-uuid',
      });
    });

  });

  // ── findOne() ─────────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return change request for owner', async () => {
      const cr = makeChangeRequest();
      mockChangeRequestsService.findOne.mockResolvedValue(cr);

      const result = await controller.findOne('cr-uuid', mockUser as any);

      expect(result).toEqual(cr);
      expect(mockChangeRequestsService.findOne).toHaveBeenCalledWith(
        'cr-uuid', mockUser.sub, false,
      );
    });

    it('should pass isAdmin=true when admin requests', async () => {
      mockChangeRequestsService.findOne.mockResolvedValue(makeChangeRequest());

      await controller.findOne('cr-uuid', mockAdminUser as any);

      expect(mockChangeRequestsService.findOne).toHaveBeenCalledWith(
        'cr-uuid', mockAdminUser.sub, true,
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockChangeRequestsService.findOne.mockRejectedValue(
        new NotFoundException('Change request not found')
      );

      await expect(controller.findOne('non-existent', mockUser as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user requests another users request', async () => {
      mockChangeRequestsService.findOne.mockRejectedValue(
        new ForbiddenException('Access denied')
      );

      await expect(controller.findOne('cr-uuid', mockUser as any))
        .rejects.toThrow(ForbiddenException);
    });

  });

  // ── update() (review) ─────────────────────────────────────────────────

  describe('update() — review', () => {

    it('should approve change request', async () => {
      const approved = makeChangeRequest({ status: CrStatusEnum.APPROVED });
      mockChangeRequestsService.review.mockResolvedValue(approved);

      const result = await controller.update(
        'cr-uuid',
        { status: CrStatusEnum.APPROVED },
        mockAdminUser as any,
      );

      expect(result.status).toBe(CrStatusEnum.APPROVED);
      expect(mockChangeRequestsService.review).toHaveBeenCalledWith(
        'cr-uuid',
        { status: CrStatusEnum.APPROVED },
        mockAdminUser.sub,
      );
    });

    it('should reject change request', async () => {
      const rejected = makeChangeRequest({ status: CrStatusEnum.REJECTED });
      mockChangeRequestsService.review.mockResolvedValue(rejected);

      const result = await controller.update(
        'cr-uuid',
        { status: CrStatusEnum.REJECTED },
        mockAdminUser as any,
      );

      expect(result.status).toBe(CrStatusEnum.REJECTED);
    });

    it('should throw NotFoundException when change request not found', async () => {
      mockChangeRequestsService.review.mockRejectedValue(
        new NotFoundException('Change request not found')
      );

      await expect(
        controller.update('non-existent', { status: CrStatusEnum.APPROVED }, mockAdminUser as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new time conflicts on approve', async () => {
      mockChangeRequestsService.review.mockRejectedValue(
        new ConflictException('New time slot conflicts')
      );

      await expect(
        controller.update('cr-uuid', { status: CrStatusEnum.APPROVED }, mockAdminUser as any)
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid status', async () => {
      mockChangeRequestsService.review.mockRejectedValue(
        new BadRequestException('Invalid status provided for review')
      );

      await expect(
        controller.update('cr-uuid', { status: 'INVALID' as any }, mockAdminUser as any)
      ).rejects.toThrow(BadRequestException);
    });

  });

});