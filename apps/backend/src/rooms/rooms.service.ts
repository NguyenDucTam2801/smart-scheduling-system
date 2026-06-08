import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomRepository } from './rooms.repository';
import { QueryRoomDto } from './dto/quey-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly roomsRepo: RoomRepository) { }

  async create(createRoomDto: CreateRoomDto) {
    const room = await this.roomsRepo.findByName(createRoomDto.name)
    if (room.length) throw new ConflictException("Room already exists. Please choose a different name.")
    return this.roomsRepo.create(createRoomDto)
  }

  async findAll(dto: QueryRoomDto) {
    const rooms = await this.roomsRepo.findMany(dto)
    if (!rooms.length) throw new NotFoundException('Rooms not found')
    return rooms
  }

  async findOne(id: string, audit: boolean = false) {
    const room = await this.roomsRepo.findById(id, audit)
    if (!room) throw new NotFoundException('Room not found')
    return room
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    const room = await this.roomsRepo.findById(id);
    if (!room) throw new NotFoundException(`Room not found`);
    // add notif service to notice all people about change the name
    return this.roomsRepo.update(id, updateRoomDto);
  }

  // async softDelete(id: string) {
  //   const room = await this.roomsRepo.findById(id);
  //   if (!room) throw new NotFoundException(`Room not found`);

  //   if (!room.isActive) {
  //     throw new BadRequestException(`Room is already deactivated`);
  //   }

  //   // Warn if room has active bookings but still allow deactivation
  //   const hasActive = await this.roomsRepo.hasActiveSchedules(id);
  //   if (hasActive) {
  //     throw new ConflictException(
  //       `Room still has active or pending schedules. Cancel them before deactivating.`,
  //     );
  //   }

  //   return this.roomsRepo.softDelete(id);
  // }

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

    return this.roomsRepo.hardDelete(id);
  }
}
