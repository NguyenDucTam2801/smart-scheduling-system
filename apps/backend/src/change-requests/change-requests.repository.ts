import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateChangeRequestDto } from "./dto/create-change-request.dto";
import { CrStatusEnum, NotifEnum, Schedule, StatusEnum } from "@prisma/client";
import { QueryChangeRequestDto } from "./dto/query-change-request.dto";
import { SchedulesRepository } from '../schedules/schedules.repository';
import { ReviewChangeRequestDto } from "./dto/review-change-request.dto";

@Injectable()
export class ChangeRequestsRepository {
    // Implement repository methods
    constructor(
        private readonly prisma: PrismaService,
        private readonly schedulesRepo: SchedulesRepository
    ) { }

    async findMany(
        query: QueryChangeRequestDto,
        requesterId?: string) {
        const { scheduleId, status, reviewedBy } = query
        return await this.prisma.changeRequest.findMany({
            where: {
                ...(scheduleId && { scheduleId }),
                ...(status && { status }),
                ...(reviewedBy && { reviewedBy }),
                ...(requesterId && { requesterId }),
            },
            orderBy: { createdAt: 'desc' }
        })
    }

    async findById(id: string) {
        return await this.prisma.changeRequest.findUnique({
            where: { id },
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                schedule: {
                    select: {
                        id: true,
                        title: true,
                        startTime: true,
                        endTime: true,
                        status: true,
                        room: {
                            select: {
                                id: true,
                                name: true,
                                location: true
                            }
                        }
                    }
                }
            },
        })
    }

    async findRequestByScheduleWithStatus(
        scheduleId: string,
        status: CrStatusEnum,
        requesterId?: string
    ) {
        return await this.prisma.changeRequest.findFirst({
            where: {
                scheduleId,
                status,
                requesterId
            }
        })
    }

    async createWithTx(
        dto: CreateChangeRequestDto,
        schedule: Schedule,
        requesterId: string
    ) {
        const { scheduleId, newStart, newEnd, reason } = dto


        let proposedStartDate = newStart ? (new Date(newStart)) : undefined
        let proposedEndDate = newEnd ? (new Date(newEnd)) : undefined

        if (proposedStartDate && proposedEndDate) {
            if (proposedStartDate > proposedEndDate) {
                throw new BadRequestException("Schedule start time cannot be after end time")
            }
        }

        return this.prisma.$transaction(async (tx) => {
            if (proposedStartDate && proposedEndDate) {
                const overlappingSchedule = await this.schedulesRepo.findOverlappingSchedules(
                    tx,
                    schedule.roomId,
                    proposedStartDate,
                    proposedEndDate
                )
                if (overlappingSchedule) {
                    throw new ConflictException("There is an overlapping schedule at the requested time")
                }
            }

            await tx.changeRequest.create(
                {
                    data: {
                        scheduleId,
                        reason,
                        ...(proposedStartDate && { newStart: proposedStartDate }),
                        ...(proposedEndDate && { newEnd: proposedEndDate }),
                        requesterId,
                    }
                }
            )

            await tx.notification.create({
                data: {
                    userId: requesterId,
                    title: 'Change request submmited',
                    message: `Your change request for "${schedule.title}" has been submitted.`,
                    type: NotifEnum.SCHEDULE_REQUEST_RESULT,
                },
            });
        }
        )
    }

    async reviewRequest(
        id: string,
        dto: ReviewChangeRequestDto,
        adminId: string,
        changeRequest: any
    ) {
        const status = dto.status

        if (status === CrStatusEnum.APPROVED) {
            return this.approveRequestTx(id, adminId, changeRequest)
        } else if (status === CrStatusEnum.REJECTED) {
            return this.rejectRequestTx(id, adminId, changeRequest)
        } else {
            throw new BadRequestException("Invalid status provided for review")
        }

    }

    private async approveRequestTx(
        id: string,
        adminId: string,
        changeRequest: any
    ) {
        return await this.prisma.$transaction(async (tx) => {
            if (changeRequest.newStart && changeRequest.newEnd) {
                const conflict = await this.schedulesRepo.findOverlappingSchedules(
                    tx,
                    changeRequest.schedule.roomId,
                    changeRequest.newStart,
                    changeRequest.newEnd,
                    changeRequest.scheduleId,  // exclude the schedule being rescheduled
                );
                if (conflict) {
                    throw new ConflictException(
                        `New time slot conflicts with an existing booking: "${conflict.title}" from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
                    );
                }
            }

            await tx.schedule.update({
                where: { id: changeRequest.scheduleId },
                data: {
                    startTime: changeRequest.newStart,
                    endTime: changeRequest.newEnd,
                    status: StatusEnum.APPROVED,
                    version: { increment: 1 },
                },
            });

            await tx.changeRequest.update({
                where: { id },
                data: {
                    status: CrStatusEnum.APPROVED,
                    reviewedBy: adminId
                }
            })

            await tx.notification.create({
                data: {
                    userId: changeRequest.requesterId,
                    title: 'Change request approved',
                    message: `Your change request for "${changeRequest.schedule.title}" has been approved.`,
                    type: NotifEnum.SCHEDULE_REQUEST_RESULT,
                },
            });

            return this.findById(changeRequest.id);
        }
        )
    }

    private async rejectRequestTx(
        id: string,
        adminId: string,
        changeRequest: any

    ) {
        return this.prisma.$transaction(async (tx) => {
            await tx.changeRequest.update({
                where: { id },
                data: {
                    status: CrStatusEnum.REJECTED,
                    reviewedBy: adminId
                }
            })
            await tx.notification.create({
                data: {
                    userId: changeRequest.requesterId,
                    title: 'Change request rejected',
                    message: `Your change request for "${changeRequest.schedule.title}" has been rejected.`,
                    type: NotifEnum.SCHEDULE_REQUEST_RESULT,
                },
            });
            return this.findById(changeRequest.id);

        })
    }
}