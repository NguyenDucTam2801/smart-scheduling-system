import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CrStatusEnum, NotifEnum, StatusEnum } from '@prisma/client';
import { validateTimeRange } from 'src/common/utils/date-filter.util';
import { CreateBroadcastDto } from 'src/notifications/dto/create-broadcast.dto';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsRepository } from 'src/notifications/notifications.repository';
import { SchedulesRepository } from '../schedules/schedules.repository';
import { ChangeRequestsRepository } from './change-requests.repository';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { QueryChangeRequestAdminDto } from './dto/query-change-request-admin.dto';
import { QueryChangeRequestUserDto } from './dto/query-change-request-user.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';

import { TransactionManager } from 'src/transaction-manager/transaction-manager.service';

@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly changeRequestsRepo: ChangeRequestsRepository,
    private readonly schedulesRepo: SchedulesRepository,
    private readonly notifRepo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
    private readonly txManager: TransactionManager
  ) { }
  async create(createChangeRequestDto: CreateChangeRequestDto, userId: string) {
    const schedule = await this.schedulesRepo.findById(createChangeRequestDto.scheduleId)
    if (!schedule) throw new NotFoundException('Schedule not found')

    if (schedule.userId !== userId) {
      throw new ForbiddenException("You can only submit change requests for your own")
    }

    if (
      schedule.status === StatusEnum.REJECTED
    ) {
      throw new BadRequestException("Cannot submit change request for rejected schedule")
    }

    const existingRequest = await this.changeRequestsRepo.findRequestByScheduleWithStatus(
      createChangeRequestDto.scheduleId,
      CrStatusEnum.PENDING,
      userId
    )

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending change request for this schedule',
      )
    }

    // const proposedStartDate = createChangeRequestDto.newStart ? (new Date(createChangeRequestDto.newStart)) : undefined
    // const proposedEndDate = createChangeRequestDto.newEnd ? (new Date(createChangeRequestDto.newEnd)) : undefined


    const result = await this.txManager.runInTransaction(async (tx) => {
      if (createChangeRequestDto.newStart && createChangeRequestDto.newEnd) {
        const isValidPeriod = validateTimeRange(createChangeRequestDto.newStart, createChangeRequestDto.newEnd)
        if (!isValidPeriod) {
          throw new BadRequestException("Invalid time range. Please ensure that the time range is valid (end time later than start time and time range is in the future).")
        }

        const conflict = await this.schedulesRepo.findOverlappingSchedules(
          schedule.roomId,
          new Date(createChangeRequestDto.newStart),
          new Date(createChangeRequestDto.newEnd),
          schedule.id,
          tx
        );
        if (conflict) {
          const nextAvailableStart = conflict.endTime;
          const durationInMs = new Date(createChangeRequestDto.newEnd).getTime() - new Date(createChangeRequestDto.newStart).getTime();
          const nextAvailableEnd = new Date(nextAvailableStart.getTime() + durationInMs);
          throw new ConflictException({
            message: `The requested time slot conflicts with an existing booking. The next available slot is from ${nextAvailableStart} to ${nextAvailableEnd}.`,
            suggestedAvailableSlot: {
              startTime: nextAvailableStart.toISOString(),
              endTime: nextAvailableEnd.toISOString(),
            }
          });
        }
      }

      const newChangeRequest = await this.changeRequestsRepo.create(
        createChangeRequestDto,
        userId,
        tx
      );
      const payload: CreateBroadcastDto = {
        userIds: [userId],
        title: 'Change request submitted',
        message: `Your change request for booking "${schedule.title}" has been submitted and is pending review.`,
        type: NotifEnum.REQUEST_SUBMITTED,
      }

      await this.notifRepo.createForUsers(payload, tx);

      return { payload, newChangeRequest }
    });

    this.gateway.notifyUser(userId, result.payload)
    return result.newChangeRequest
  }

  async findAllForUser(
    query: QueryChangeRequestUserDto,
    requestUserId: string,
  ) {
    return await this.changeRequestsRepo.findMany(
      query,
      requestUserId
    );
  }

  async findAllForAdmin(
    query: QueryChangeRequestAdminDto,
  ) {
    return await this.changeRequestsRepo.findMany(
      query,
      query.requesterId
    );
  }

  async findOne(id: string, requestUserId: string, isAdmin: boolean) {
    const changeRequest = await this.changeRequestsRepo.findById(id);
    if (!changeRequest) throw new NotFoundException('Change request not found');

    if (!isAdmin && changeRequest.requesterId !== requestUserId) {
      throw new ForbiddenException('Access denied');
    }

    return changeRequest;
  }

  async review(id: string,
    reviewChangeRequestDto: ReviewChangeRequestDto,
    userId: string
  ) {
    const changeRequest = await this.changeRequestsRepo.findById(id);
    if (!changeRequest) throw new NotFoundException('Change request not found');

    if(changeRequest.status !== CrStatusEnum.PENDING) {
      throw new ConflictException('Change request has already been reviewed');
    }
    
    const status = reviewChangeRequestDto.status

    if (status === CrStatusEnum.APPROVED) {
      // return this.changeRequestsRepo.approveRequestTx(id, requestUserId, changeRequest)
      const result = await this.txManager.runInTransaction(async (tx) => {
        if (changeRequest.newStart && changeRequest.newEnd) {
          const conflict = await this.schedulesRepo.findOverlappingSchedules(
            changeRequest.schedule.room.id,
            changeRequest.newStart,
            changeRequest.newEnd,
            changeRequest.scheduleId,  // exclude the schedule being rescheduled
            tx
          );
          if (conflict) {
            throw new ConflictException(
              `New time slot conflicts with an existing booking: "${conflict.title}" from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
            );
          }
        }
        const approveResult = await this.changeRequestsRepo.approveRequest(id, userId, changeRequest, tx)
        const payload: CreateBroadcastDto = {
          userIds: [changeRequest.requesterId, userId],
          title: 'Change request approved',
          message: `Your change request for booking "${changeRequest.schedule.title}" has been approved by admin ${userId}.`,
          type: NotifEnum.REQUEST_APPROVED,
        }
        await this.notifRepo.createForUsers(payload, tx);
        return { payload, approveResult }
      })
      this.gateway.notifyUsers([changeRequest.requesterId, userId], result.payload)
      return result.approveResult

    } else if (status === CrStatusEnum.REJECTED) {
      // return this.changeRequestsRepo.rejectRequestTx(id, requestUserId, changeRequest)
      const result = await this.txManager.runInTransaction(async (tx) => {
        const rejectResult = await this.changeRequestsRepo.rejectRequest(id, userId, tx)
        const payload: CreateBroadcastDto = {
          userIds: [changeRequest.requesterId, userId],
          title: 'Change request rejected',
          message: `Your change request for booking "${changeRequest.schedule.title}" has been rejected by admin ${userId}.`,
          type: NotifEnum.REQUEST_REJECTED,
        }
        await this.notifRepo.createForUsers(payload, tx);
        return { payload, rejectResult }
      })
      this.gateway.notifyUsers([changeRequest.requesterId, userId], result.payload)
      return result.rejectResult
    } else {
      throw new BadRequestException("Invalid status provided for review")
    }
  }
}