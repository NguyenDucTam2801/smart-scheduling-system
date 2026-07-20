import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotifEnum } from '@prisma/client';
import { CreateBroadcastDto } from 'src/notifications/dto/create-broadcast.dto';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { QueryRoomDto } from './dto/quey-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomRepository } from './rooms.repository';

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomsRepo: RoomRepository,
    private readonly notifRepo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
    private readonly txManager: TransactionManager

  ) { }

  async create(createRoomDto: CreateRoomDto, userId: string) {
    const room = await this.roomsRepo.findByName(createRoomDto.name)
    if (room.length) throw new ConflictException("Room already exists. Please choose a different name.")
    const result = await this.txManager.runInTransaction(async (tx) => {
      const newRoom = await this.roomsRepo.create(createRoomDto, tx)

      const payload: CreateBroadcastDto = {
        userIds: [userId],
        title: 'Existed schedule updated',
        message: `Your booking "${newRoom.id}" has been updated by admin ${userId}`,
        type: NotifEnum.ROOM_CREATED,
      }

      await this.notifRepo.createForUsers(payload, tx);

      return { newRoom, payload }

    })
    this.gateway.notifyAll(result.payload);
    return result.newRoom
  }

  async findAll(dto: QueryRoomDto) {
    const rooms = await this.roomsRepo.findMany(dto)
    if (!rooms.length && Object.keys(dto).length !== 0) throw new NotFoundException('Rooms not found')
    return rooms
  }

  async findOne(id: string, audit: boolean = false) {
    const room = await this.roomsRepo.findById(id, audit)
    if (!room) throw new NotFoundException('Room not found')
    return room
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, userId: string) {
    const room = await this.roomsRepo.findById(id);
    if (!room) throw new NotFoundException(`Room not found`);
    // add notif service to notice all people about change the name
    if (!updateRoomDto.isActive) {
      const hasActive = await this.roomsRepo.hasActiveSchedules(id);
      if (hasActive) {
        throw new ConflictException(
          `Cannot deactivate a room with existing schedules.`,
        );
      }
    }
    const result = await this.txManager.runInTransaction(async (tx) => {

      const updatedRoom = await this.roomsRepo.update(id, updateRoomDto, tx);

      let payload: CreateBroadcastDto = {
        title: 'Room updated',
        message: `The room "${updatedRoom.name}" has been updated by admin ${userId}.`,
        type: NotifEnum.ROOM_UPDATED,
      };

      await this.notifRepo.createForAllUsers(payload, tx);
      return { updatedRoom, payload }
    })

    await this.gateway.notifyAll(result.payload);
    return result.updatedRoom;
  }

  async hardDelete(id: string) {
    const room = await this.roomsRepo.findById(id);
    if (!room) throw new NotFoundException(`Room not found`);

    // Safety: only allow hard delete on already-deactivated rooms
    if (room.isActive) {
      throw new BadRequestException(
        `Deactivate the room before permanently deleting it.`,
      );
    }

    // Safety: block if any schedules reference this room (FK constraint)
    const hasActive = await this.roomsRepo.hasActiveSchedules(id);
    if (hasActive) {
      throw new ConflictException(
        `Cannot permanently delete a room with existing schedules.`,
      );
    }

    const result = await this.txManager.runInTransaction(async (tx) => {
      const deletedRoom = await this.roomsRepo.remove(id, tx);

      const payload: CreateBroadcastDto = {
        title: 'Room deleted',
        message: `The room "${deletedRoom.name}" has been permanently deleted.`,
        type: NotifEnum.ROOM_DELETED,
      };

      await this.notifRepo.createForAllUsers(payload, tx);
      return { payload, deletedRoom }
    })

    this.gateway.notifyAll(result.payload)

    return result.deletedRoom;
  }
}
