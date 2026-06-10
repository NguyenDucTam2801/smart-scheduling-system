import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { SchedulesRepository } from './schedules.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

import { buildPrismaTimeFilter } from 'src/common/utils/date-filter.util';
import { NotifEnum, StatusEnum } from '@prisma/client';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly schedulesRepo: SchedulesRepository, private readonly prisma: PrismaService) { }

  async create(createScheduleDto: CreateScheduleDto, adminId: string) {
    const startTime = new Date(createScheduleDto.startTime)
    const endTime = new Date(createScheduleDto.endTime)

    if (startTime >= endTime) {
      throw new ConflictException("startTime must be before endTime")
    }

    return await this.prisma.$transaction(async (tx) => {
      const conflict = await this.schedulesRepo.findOverlappingSchedules(
        tx,
        createScheduleDto.roomId,
        startTime,
        endTime
      )

      if (conflict) {
        throw new ConflictException(
          `Room is already booked from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
        )
      }

      await tx.schedule.create({
        data: {
          ...createScheduleDto,
          userId: adminId
        },
      })

      await tx.notification.create({
        data: {
          userId: adminId,
          title: 'New schedule created',
          message: `Your booking "${createScheduleDto.title}" has been submitted and is pending approval.`,
          type: NotifEnum.SCHEDULE_APPROVED,
        }
      })

    })
  }

  async findAll(query: QueryScheduleDto, requestUserId: string, isAdmin: boolean) {
    const { view, date, roomId, userId, status, title, version } = query

    let timeFilter: {
      startTime?: { gte: Date };
      endTime?: { lte: Date };
    } = buildPrismaTimeFilter(date, view)

    let userFilter: { userId: string };

    if (!isAdmin) {
      if (userId && userId != requestUserId) {
        throw new ForbiddenException('You are not authorized to view other users schedules')
      } else {
        userFilter = { userId: requestUserId }
      }
    } else {
      if (userId) {
        userFilter = { userId }
      } else {
        userFilter = { userId: requestUserId }
      }
    }


    return await this.prisma.schedule.findMany({
      where: {
        ...timeFilter,
        ...userFilter,
        ...(roomId && { roomId }),
        ...(status && { status }),
        ...(title && { title }),
        ...(version && { version })
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        room: {
          select: { id: true, name: true, location: true }
        }
      },
      orderBy: { startTime: 'asc' }
    })
  }

  async findOne(id: string, userId: string, isAdmin: boolean) {
    const schedule = await this.schedulesRepo.findById(id);
    if (!schedule) throw new NotFoundException('Schedule not found');

    // Users can only view their own
    if (!isAdmin && schedule.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return schedule;
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.schedulesRepo.findById(id)
    if (!schedule) {
      throw new NotFoundException('Schedule not found')
    }

    if (schedule.status === StatusEnum.CANCELLED) {
      throw new ConflictException('Cannot Update a cancelled schedule')
    }

    const affected = await this.schedulesRepo.updateStatusWithLock(
      id, updateScheduleDto
    )

    if (affected == 0) {
      throw new ConflictException(
        'Schedule was modified by another admin. Please refresh and try again.',
      )
    }

    return await this.schedulesRepo.findById(id)
  }

  async remove(id: string) {

    return await this.prisma.schedule.delete({
      where: { id }
    })
  }

  async cancel(id: string) {

    const schedule = await this.schedulesRepo.findById(id);
    if (!schedule) throw new NotFoundException("Schedule not found")

    if (schedule.status === StatusEnum.CANCELLED) {
      throw new ConflictException("Schedule is already cancelled")
    }

    return await this.schedulesRepo.cancel(id)
  }

}
