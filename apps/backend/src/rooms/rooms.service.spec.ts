import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NotifEnum } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { RoomRepository } from './rooms.repository';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { mockRoomRepository } from './__mocks__/rooms.repository.mock';
import { mockNotificationsRepository } from 'src/notifications/__mocks__/notifications.repository.mock';
import { mockNotificationsGateway } from 'src/notifications/__mocks__/notifications.gateway.mock';
import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';
import { mockTransactionManager } from 'src/transaction-manager/__mocks__/transaction-manager.mock';


// ── Helpers ────────────────────────────────────────────────────────
const makeRoom = (overrides = {}) => ({
  id: 'room-uuid',
  name: 'Room A',
  capacity: 30,
  location: 'Floor 2',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(async () => {
    // Reset transaction mock to default (pass-through)
    mockTransactionManager.runInTransaction.mockImplementation((fn) => fn(undefined));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: RoomRepository, useValue: mockRoomRepository },
        { provide: NotificationsRepository, useValue: mockNotificationsRepository },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: TransactionManager, useValue: mockTransactionManager },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    jest.clearAllMocks();
  });

  // ── create() ───────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = { name: 'Room A', capacity: 30, location: 'Floor 2' };
    const userId = 'admin-uuid';

    it('should create room and emit notification when name is unique', async () => {
      const newRoom = makeRoom();
      mockRoomRepository.findByName.mockResolvedValue([]);        // no existing room
      mockRoomRepository.create.mockResolvedValue(newRoom);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      const result = await service.create(dto, userId);

      expect(result).toEqual(newRoom);
      expect(mockRoomRepository.findByName).toHaveBeenCalledWith('Room A');
      expect(mockRoomRepository.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyAll).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when room name already exists', async () => {
      mockRoomRepository.findByName.mockResolvedValue([makeRoom()]); // name taken

      await expect(service.create(dto, userId))
        .rejects.toThrow(ConflictException);

      await expect(service.create(dto, userId))
        .rejects.toThrow('Room already exists');

      expect(mockRoomRepository.create).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails', async () => {
      mockRoomRepository.findByName.mockResolvedValue([]);
      mockTransactionManager.runInTransaction.mockRejectedValue(
        new Error('DB error')
      );

      await expect(service.create(dto, userId)).rejects.toThrow('DB error');
      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should pass correct notification payload', async () => {
      const newRoom = makeRoom();
      mockRoomRepository.findByName.mockResolvedValue([]);
      mockRoomRepository.create.mockResolvedValue(newRoom);
      mockNotificationsRepository.createForUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      await service.create(dto, userId);

      const notifyAllCall = mockNotificationsGateway.notifyAll.mock.calls[0][0];
      expect(notifyAllCall).toHaveProperty('type', NotifEnum.ROOM_CREATED);
      expect(notifyAllCall).toHaveProperty('title');
      expect(notifyAllCall).toHaveProperty('message');
    });
  });

  // ── findAll() ──────────────────────────────────────────────────────

  describe('findAll()', () => {

    it('should return all rooms when no filters applied', async () => {
      const rooms = [makeRoom(), makeRoom({ id: 'room-2', name: 'Room B' })];
      mockRoomRepository.findMany.mockResolvedValue(rooms);

      const result = await service.findAll({});

      expect(result).toHaveLength(2);
      expect(mockRoomRepository.findMany).toHaveBeenCalledWith({});
    });

    it('should return empty array when no filters applied and no rooms', async () => {
      mockRoomRepository.findMany.mockResolvedValue([]);

      const result = await service.findAll({});
      expect(result).toHaveLength(0);
    });

    it('should throw NotFoundException when filters applied but no rooms found', async () => {
      mockRoomRepository.findMany.mockResolvedValue([]);

      await expect(
        service.findAll({ name: 'NonExistentRoom' })
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findAll({ name: 'NonExistentRoom' })
      ).rejects.toThrow('Rooms not found');
    });

    it('should return filtered rooms when filters match', async () => {
      const rooms = [makeRoom()];
      mockRoomRepository.findMany.mockResolvedValue(rooms);

      const result = await service.findAll({ isActive: true });
      expect(result).toEqual(rooms);
    });

  });

  // ── findOne() ──────────────────────────────────────────────────────

  describe('findOne()', () => {

    it('should return room when found', async () => {
      const room = makeRoom();
      mockRoomRepository.findById.mockResolvedValue(room);

      const result = await service.findOne('room-uuid');

      expect(result).toEqual(room);
      expect(mockRoomRepository.findById).toHaveBeenCalledWith('room-uuid', false);
    });

    it('should return room with schedules when audit=true', async () => {
      const room = makeRoom({ schedules: [], _count: { schedules: 0 } });
      mockRoomRepository.findById.mockResolvedValue(room);

      const result = await service.findOne('room-uuid', true);

      expect(mockRoomRepository.findById).toHaveBeenCalledWith('room-uuid', true);
      expect(result).toHaveProperty('schedules');
    });

    it('should throw NotFoundException when room does not exist', async () => {
      mockRoomRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent'))
        .rejects.toThrow(NotFoundException);

      await expect(service.findOne('non-existent'))
        .rejects.toThrow('Room not found');
    });

  });

  // ── update() ───────────────────────────────────────────────────────

  describe('update()', () => {
    const dto = { name: 'Room A Updated', capacity: 40 };
    const userId = 'admin-uuid';

    it('should update room and emit notification', async () => {
      const room = makeRoom();
      const updatedRoom = makeRoom({ name: 'Room A Updated', capacity: 40 });
      mockRoomRepository.findById.mockResolvedValue(room);
      mockRoomRepository.update.mockResolvedValue(updatedRoom);
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      const result = await service.update('room-uuid', dto, userId);

      expect(result).toEqual(updatedRoom);
      expect(mockRoomRepository.update).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyAll).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when room does not exist', async () => {
      mockRoomRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', dto, userId)
      ).rejects.toThrow(NotFoundException);

      expect(mockRoomRepository.update).not.toHaveBeenCalled();
      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails', async () => {
      mockRoomRepository.findById.mockResolvedValue(makeRoom());
      mockTransactionManager.runInTransaction.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update('room-uuid', dto, userId)
      ).rejects.toThrow('DB error');

      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should pass correct notification payload with room name', async () => {
      const updatedRoom = makeRoom({ name: 'Room A Updated' });
      mockRoomRepository.findById.mockResolvedValue(makeRoom());
      mockRoomRepository.update.mockResolvedValue(updatedRoom);
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      await service.update('room-uuid', dto, userId);

      const notifyPayload = mockNotificationsGateway.notifyAll.mock.calls[0][0];
      expect(notifyPayload.message).toContain('Room A Updated');
    });

  });

  // ── hardDelete() ───────────────────────────────────────────────────

  describe('hardDelete()', () => {

    it('should hard delete deactivated room with no active schedules', async () => {
      const room = makeRoom({ isActive: false });
      const deletedRoom = makeRoom({ isActive: false });
      mockRoomRepository.findById.mockResolvedValue(room);
      mockRoomRepository.hasActiveSchedules.mockResolvedValue(false);
      mockRoomRepository.remove.mockResolvedValue(deletedRoom);
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      const result = await service.hardDelete('room-uuid');

      expect(result).toEqual(deletedRoom);
      expect(mockRoomRepository.remove).toHaveBeenCalledTimes(1);
      expect(mockNotificationsGateway.notifyAll).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when room does not exist', async () => {
      mockRoomRepository.findById.mockResolvedValue(null);

      await expect(service.hardDelete('non-existent'))
        .rejects.toThrow(NotFoundException);

      expect(mockRoomRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when room is still active', async () => {
      mockRoomRepository.findById.mockResolvedValue(makeRoom({ isActive: true }));

      await expect(service.hardDelete('room-uuid'))
        .rejects.toThrow(BadRequestException);

      await expect(service.hardDelete('room-uuid'))
        .rejects.toThrow('Deactivate the room before permanently deleting it');

      expect(mockRoomRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when room has active schedules', async () => {
      mockRoomRepository.findById.mockResolvedValue(makeRoom({ isActive: false }));
      mockRoomRepository.hasActiveSchedules.mockResolvedValue(true);

      await expect(service.hardDelete('room-uuid'))
        .rejects.toThrow(ConflictException);

      await expect(service.hardDelete('room-uuid'))
        .rejects.toThrow('Cannot permanently delete a room with existing schedules');

      expect(mockRoomRepository.remove).not.toHaveBeenCalled();
    });

    it('should not emit notification when transaction fails', async () => {
      mockRoomRepository.findById.mockResolvedValue(makeRoom({ isActive: false }));
      mockRoomRepository.hasActiveSchedules.mockResolvedValue(false);
      mockTransactionManager.runInTransaction.mockRejectedValue(new Error('DB error'));

      await expect(service.hardDelete('room-uuid')).rejects.toThrow('DB error');
      expect(mockNotificationsGateway.notifyAll).not.toHaveBeenCalled();
    });

    it('should pass correct notification payload with deleted room name', async () => {
      const room = makeRoom({ isActive: false });
      mockRoomRepository.findById.mockResolvedValue(room);
      mockRoomRepository.hasActiveSchedules.mockResolvedValue(false);
      mockRoomRepository.remove.mockResolvedValue(room);
      mockNotificationsRepository.createForAllUsers.mockResolvedValue(undefined);
      mockTransactionManager.runInTransaction.mockImplementation(async (fn) => fn(undefined));

      await service.hardDelete('room-uuid');

      const notifyPayload = mockNotificationsGateway.notifyAll.mock.calls[0][0];
      expect(notifyPayload.message).toContain('Room A');
      expect(notifyPayload.title).toBe('Room deleted');
    });

  });

});