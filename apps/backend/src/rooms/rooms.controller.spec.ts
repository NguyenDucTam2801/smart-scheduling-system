import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { mockRoomsService } from './__mocks__/rooms.service.mock';

const mockUser = { sub: 'admin-uuid', email: 'admin@example.com', role: 'ADMIN' };

const makeRoom = (overrides = {}) => ({
  id: 'room-uuid',
  name: 'Room A',
  capacity: 30,
  isActive: true,
  ...overrides,
});

describe('RoomsController', () => {
  let controller: RoomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        { provide: RoomsService, useValue: mockRoomsService },
      ],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create() ──────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = { name: 'Room A', capacity: 30, location: 'Floor 2' };

    it('should create and return a room', async () => {
      const room = makeRoom();
      mockRoomsService.create.mockResolvedValue(room);

      const result = await controller.create(dto, mockUser as any);

      expect(result).toEqual(room);
      expect(mockRoomsService.create).toHaveBeenCalledWith(dto, mockUser.sub);
    });

    it('should throw when room name already exists', async () => {
      mockRoomsService.create.mockRejectedValue(
        new ConflictException('Room already exists')
      );

      await expect(controller.create(dto, mockUser as any))
        .rejects.toThrow(ConflictException);
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────

  describe('findAll()', () => {

    it('should return all rooms', async () => {
      const rooms = [makeRoom(), makeRoom({ id: 'room-2', name: 'Room B' })];
      mockRoomsService.findAll.mockResolvedValue(rooms);

      const result = await controller.findAll({});

      expect(result).toHaveLength(2);
      expect(mockRoomsService.findAll).toHaveBeenCalledWith({});
    });

    it('should throw NotFoundException when filtered and no results', async () => {
      mockRoomsService.findAll.mockRejectedValue(
        new NotFoundException('Rooms not found')
      );

      await expect(
        controller.findAll({ name: 'NonExistent' })
      ).rejects.toThrow(NotFoundException);
    });

  });

  // ── findOne() ─────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return one room', async () => {
      const room = makeRoom();
      mockRoomsService.findOne.mockResolvedValue(room);

      const result = await controller.findOne('room-uuid');

      expect(result).toEqual(room);
      expect(mockRoomsService.findOne).toHaveBeenCalledWith('room-uuid');
    });

    it('should throw NotFoundException when room not found', async () => {
      mockRoomsService.findOne.mockRejectedValue(
        new NotFoundException('Room not found')
      );

      await expect(controller.findOne('non-existent'))
        .rejects.toThrow(NotFoundException);
    });

  });

  // ── findOneAudit() ────────────────────────────────────────────────

  describe('findOneAudit()', () => {

    it('should call findOne with audit=true', async () => {
      const room = makeRoom({ schedules: [], _count: { schedules: 0 } });
      mockRoomsService.findOne.mockResolvedValue(room);

      const result = await controller.findOneAudit('room-uuid');

      expect(mockRoomsService.findOne).toHaveBeenCalledWith('room-uuid', true);
      expect(result).toHaveProperty('schedules');
    });

  });

  // ── update() ──────────────────────────────────────────────────────

  describe('update()', () => {
    const dto = { capacity: 40 };

    it('should update and return the room', async () => {
      const updated = makeRoom({ capacity: 40 });
      mockRoomsService.update.mockResolvedValue(updated);

      const result = await controller.update('room-uuid', dto, mockUser as any);

      expect(result).toEqual(updated);
      expect(mockRoomsService.update).toHaveBeenCalledWith('room-uuid', dto, mockUser.sub);
    });

    it('should throw NotFoundException when room not found', async () => {
      mockRoomsService.update.mockRejectedValue(
        new NotFoundException('Room not found')
      );

      await expect(
        controller.update('non-existent', dto, mockUser as any)
      ).rejects.toThrow(NotFoundException);
    });

  });

  // ── hardDelete() ──────────────────────────────────────────────────

  describe('hardDelete()', () => {

    it('should hard delete and return the deleted room', async () => {
      const room = makeRoom({ isActive: false });
      mockRoomsService.hardDelete.mockResolvedValue(room);

      const result = await controller.hardDelete('room-uuid');

      expect(result).toEqual(room);
      expect(mockRoomsService.hardDelete).toHaveBeenCalledWith('room-uuid');
    });

    it('should throw BadRequestException when room is still active', async () => {
      mockRoomsService.hardDelete.mockRejectedValue(
        new BadRequestException('Deactivate the room before permanently deleting it')
      );

      await expect(controller.hardDelete('room-uuid'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when room has active schedules', async () => {
      mockRoomsService.hardDelete.mockRejectedValue(
        new ConflictException('Cannot permanently delete a room with existing schedules')
      );

      await expect(controller.hardDelete('room-uuid'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when room does not exist', async () => {
      mockRoomsService.hardDelete.mockRejectedValue(
        new NotFoundException('Room not found')
      );

      await expect(controller.hardDelete('non-existent'))
        .rejects.toThrow(NotFoundException);
    });

  });

});