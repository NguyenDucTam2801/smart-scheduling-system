import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleUserDto } from './dto/query-schedule-user.dto';
import { SchedulesRepository } from './schedules.repository';
import { NotifEnum, StatusEnum } from '@prisma/client';
import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';
import { buildPrismaTimeFilter, validateTimeRange } from 'src/common/utils/date-filter.util';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { QueryScheduleAdminDto } from './dto/query-schedule-admin.dto';
import { UpdateScheduleAdminDto } from './dto/update-schedule-admin.dto';
import { UpdateScheduleUserDto } from './dto/update-schedule-user.dto';
import { CreateBroadcastDto } from 'src/notifications/dto/create-broadcast.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly schedulesRepo: SchedulesRepository,
    private readonly notifRepo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
    private readonly txManager: TransactionManager
  ) { }

  async create(createScheduleDto: CreateScheduleDto, userId: string) {

    const isValidPeriod = validateTimeRange(createScheduleDto.startTime, createScheduleDto.endTime)
    if (!isValidPeriod) {
      throw new BadRequestException("Invalid time range. Please ensure that the time range is valid (end time later than start time and time range is in the future).")
    }

    const startTime = new Date(createScheduleDto.startTime)
    const endTime = new Date(createScheduleDto.endTime)
    // return this.schedulesRepo.create(createScheduleDto, userId)

    const result = await this.txManager.runInTransaction(async (tx) => {
      const conflict = await this.schedulesRepo.findOverlappingSchedules(
        createScheduleDto.roomId,
        startTime,
        endTime,
        undefined,
        tx
      );

      if (conflict) {
        throw new ConflictException(
          `Room is already booked from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
        );
      }

      const schedule = await this.schedulesRepo.create(
        createScheduleDto,
        userId,
        tx,
      );

      const payload: CreateBroadcastDto = {
        userIds: [userId],
        title: 'New schedule created',
        message: `Your booking "${createScheduleDto.title}" has been submitted.`,
        type: NotifEnum.SCHEDULE_CREATED,
      }

      await this.notifRepo.createForUsers(payload, tx);
      return { payload, schedule }
    })
    this.gateway.notifyUser(userId, result.payload)
    return result.schedule
  }

  async findAllForUser(query: QueryScheduleUserDto, requestUserId: string) {
    const { view, date, ...rest } = query

    let timeFilter: {
      startTime?: { gte: Date };
      endTime?: { lte: Date };
    } = buildPrismaTimeFilter(date, view)

    return await this.schedulesRepo.findMany({ ...timeFilter, ...rest }, requestUserId)
  }

  async findAllForAdmin(query: QueryScheduleAdminDto) {
    const { view, date, ...rest } = query

    let timeFilter: {
      startTime?: { gte: Date };
      endTime?: { lte: Date };
    } = buildPrismaTimeFilter(date, view)

    return await this.schedulesRepo.findMany({ ...timeFilter, ...rest }, rest?.userId)
  }

  async findOne(id: string, requestUserId: string, isAdmin: boolean) {
    const schedule = await this.schedulesRepo.findById(id);
    if (!schedule) throw new NotFoundException('Schedule not found');

    // Users can only view their own
    if (!isAdmin && schedule.userId !== requestUserId) {
      throw new ForbiddenException('Access denied');
    }
    return schedule;
  }

  async updateForAdmin(id: string, updateScheduleDto: UpdateScheduleAdminDto, userId: string) {
    const schedule = await this.schedulesRepo.findById(id)
    if (!schedule) {
      throw new NotFoundException('Schedule not found')
    }

    if (schedule.status === StatusEnum.CANCELLED || schedule.status === StatusEnum.REJECTED) {
      throw new ConflictException('Cannot Update a cancelled or rejected schedule')
    }

    if (schedule.status === StatusEnum.FINISHED) {
      throw new ConflictException('Cannot Update a happended schdedule')
    }

    if (updateScheduleDto.status) {
      if (updateScheduleDto.status !== StatusEnum.APPROVED && updateScheduleDto.status !== StatusEnum.REJECTED) {
        throw new BadRequestException("Admin can just restore approve or reject a schedule")
      }
    }

    // Optimistic locking — version must be provided
    if (updateScheduleDto.version === undefined || updateScheduleDto.version === null || updateScheduleDto.version !== schedule.version) {

      throw new BadRequestException('version is invalid for updates');
    }

    const newStart = updateScheduleDto.startTime ? new Date(updateScheduleDto.startTime) : schedule.startTime
    const newEnd = updateScheduleDto.endTime ? new Date(updateScheduleDto.endTime) : schedule.endTime
    const isValidPeriod = validateTimeRange(newStart, newEnd)
    if (!isValidPeriod) {
      throw new BadRequestException("Invalid time range. Please ensure that the time range is valid (end time later than start time and time range is in the future).")
    }
    // console.log(`updateScheduleDto: ${JSON.stringify(updateScheduleDto)}, schedule: ${JSON.stringify(schedule)}`);
    // if (updateScheduleDto.title == 'Updated admin B') {
    //   console.log(`updateScheduleDto: ${JSON.stringify(updateScheduleDto)}, schedule: ${JSON.stringify(schedule)}`);
    // }

    const result = await this.txManager.runInTransaction(async (tx) => {
      const conflict = await this.schedulesRepo.findOverlappingSchedules(
        updateScheduleDto.roomId ?? schedule.roomId,
        newStart,
        newEnd,
        id,   // exclude self
        tx
      );
      if (conflict) {
        throw new ConflictException(
          `Room is already booked from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
        );
      }

      const affected = await this.schedulesRepo.updateForAdminWithLock(id, updateScheduleDto, tx);

      if (affected === 0) {
        throw new ConflictException(
          'Schedule was modified by another user while you were editing it. Please refresh and try again.',
        );
      }

      const payload: CreateBroadcastDto = {
        userIds: [schedule.userId, userId],
        title: 'Existed schedule updated',
        message: `The booking "${schedule.id}" has been updated by admin ${userId}`,
        type: NotifEnum.SCHEDULE_UPDATTED,
      }

      await this.notifRepo.createForUsers(payload, tx)

      return { payload, schedule: await this.schedulesRepo.findById(id, tx) }
    })

    await this.gateway.notifyUsers([schedule.userId, userId], result.payload)
    return result.schedule
  }

  async updateForUser(
    id: string,
    updateScheduleDto: UpdateScheduleUserDto,
    userId: string
  ) {
    const schedule = await this.schedulesRepo.findById(id);
    if (!schedule) throw new NotFoundException('Schedule not found');

    // Users can only update their own schedules
    if (schedule.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (schedule.status === StatusEnum.CANCELLED) {
      throw new ConflictException('Schedule is already cancelled');
    }

    // Users can only set status to CANCELLED — no other status allowed
    if (updateScheduleDto.status && updateScheduleDto.status !== StatusEnum.CANCELLED) {
      throw new ForbiddenException(
        'You can only cancel your own schedule. Contact an admin for other status changes.',
      );
    }

    if (updateScheduleDto.version === undefined || updateScheduleDto.version === null || updateScheduleDto.version !== schedule.version) {
      throw new BadRequestException('version is invalid for updates');
    }
    const result = await this.txManager.runInTransaction(async (tx) => {
      const affected = await this.schedulesRepo.updateForUserWithLock(id, updateScheduleDto, tx);
      if (affected === 0) {
        throw new ConflictException(
          'Schedule was modified by another user while you were editing it. Please refresh and try again.',
        );
      }
      const payload: CreateBroadcastDto = {
        userIds: [schedule.userId],
        title: 'Existed schedule updated',
        message: `Your booking "${schedule.id}" has been updated.`,
        type: NotifEnum.SCHEDULE_UPDATTED,
      }

      await this.notifRepo.createForUsers(payload, tx)
      return { payload, schedule: await this.schedulesRepo.findById(id, tx) }


    })
    await this.gateway.notifyUser(schedule.userId, result.payload)
    return result.schedule

  }


  async delete(id: string, userId: string) {
    const schedule = await this.schedulesRepo.findById(id)
    if (!schedule) {
      throw new NotFoundException("This schedule does not exist")
    }

    if (schedule.status !== StatusEnum.CANCELLED) {
      throw new ConflictException('Only cancelled schedules can be deleted');
    }

    const result = await this.txManager.runInTransaction(async (tx) => {
      const deletedSchedule = await this.schedulesRepo.delete(id, tx)

      const payload: CreateBroadcastDto = {
        userIds: [schedule.userId, userId],
        title: 'Schedule deleted',
        message: `Your booking "${schedule.id}" has been deleted permanently.`,
        type: NotifEnum.SCHEDULE_DELETED,
      }

      await this.notifRepo.createForUsers(payload, tx)

      return { payload, deletedSchedule }
    })

    await this.gateway.notifyUsers([schedule.userId, userId], result.payload)
    return result.deletedSchedule
  }




}
