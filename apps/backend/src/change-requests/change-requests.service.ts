import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto'
import { ChangeRequestsRepository } from './change-requests.repository';
import { SchedulesRepository } from '../schedules/schedules.repository';
import { CrStatusEnum, StatusEnum } from '@prisma/client';
import { QueryChangeRequestDto } from './dto/query-change-request.dto';

@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly changeRequestsRepo: ChangeRequestsRepository,
    private readonly schedulesRepository: SchedulesRepository,
  ) { }
  async create(createChangeRequestDto: CreateChangeRequestDto, requesterId: string) {
    const schedule = await this.schedulesRepository.findById(createChangeRequestDto.scheduleId)
    if (!schedule) throw new NotFoundException('Schedule not found')

    if (schedule.userId !== requesterId) {
      throw new ForbiddenException("You can only submit change requests for your own")
    }

    if (
      schedule.status === StatusEnum.CANCELLED ||
      schedule.status === StatusEnum.REJECTED
    ) {
      throw new BadRequestException("Cannot submit change request for cancelled or rejected schedule")
    }

    const existingRequest = await this.changeRequestsRepo.findRequestByScheduleWithStatus(
      createChangeRequestDto.scheduleId,
      CrStatusEnum.PENDING,
      requesterId
    )

    if (existingRequest) {
      throw new ConflictException(
        'You already have a pending change request for this schedule',
      )
    }

    return this.changeRequestsRepo.createWithTx(
      createChangeRequestDto,
      schedule,
      requesterId
    )

  }

  async findAll(
    query: QueryChangeRequestDto,
    requesterId: string,
    isAdmin: boolean,
  ) {
    if (!isAdmin && query.requesterId !== requesterId) {
      throw new ForbiddenException('You can only get your own requestes')
    }

    return await this.changeRequestsRepo.findMany(
      query,
      isAdmin ? query.requesterId : requesterId,
    );
  }

  async findOne(id: string, requesterId: string, isAdmin: boolean) {
    const changeRequest = await this.changeRequestsRepo.findById(id);
    if (!changeRequest) throw new NotFoundException('Change request not found');

    if (!isAdmin && changeRequest.requesterId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }

    return changeRequest;
  }

  async review(id: string,
    dto: ReviewChangeRequestDto,
    adminId: string
  ) {
    const changeRequest = await this.changeRequestsRepo.findById(id);
    if (!changeRequest) throw new NotFoundException('Change request not found');

    return this.changeRequestsRepo.reviewRequest(id, dto, adminId, changeRequest)
  }

  // remove(id: number) {
  //   return `This action removes a #${id} changeRequest`;
  // }
}
