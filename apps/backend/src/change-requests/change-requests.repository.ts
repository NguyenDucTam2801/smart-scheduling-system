import { Injectable } from "@nestjs/common";
import { CrStatusEnum, StatusEnum } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateChangeRequestDto } from "./dto/create-change-request.dto";
import { QueryChangeRequestAdminDto } from "./dto/query-change-request-admin.dto";
import { QueryChangeRequestUserDto } from "./dto/query-change-request-user.dto";

@Injectable()
export class ChangeRequestsRepository {
    // Implement repository methods
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async findMany(
        query: QueryChangeRequestUserDto | QueryChangeRequestAdminDto,
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
        // console.log(`id:${id}`);
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

    async create(dto: CreateChangeRequestDto,
        userId: string,
        tx?: PrismaService) {
        const { scheduleId, newStart, newEnd, reason } = dto

        let proposedStartDate = newStart ? (new Date(newStart)) : undefined
        let proposedEndDate = newEnd ? (new Date(newEnd)) : undefined

        const prismaClient = tx || this.prisma


        return prismaClient.changeRequest.create(
            {
                data: {
                    scheduleId,
                    reason,
                    ...(proposedStartDate && { newStart: proposedStartDate }),
                    ...(proposedEndDate && { newEnd: proposedEndDate }),
                    requesterId: userId,
                }
            }
        )
    }




    async approveRequest(
        id: string,
        userId: string,
        changeRequest: any,
        tx?: PrismaService
    ) {

        const prismaClient = tx || this.prisma
        await prismaClient.schedule.update({
            where: { id: changeRequest.scheduleId, version: changeRequest.schedule.version },
            data: {
                ...(changeRequest.newStart && { startTime: changeRequest.newStart }),
                ...(changeRequest.newEnd && { endTime: changeRequest.newEnd }),
                status: StatusEnum.APPROVED,
                version: { increment: 1 },
            },
        });

        return await prismaClient.changeRequest.update({
            where: { id },
            data: {
                status: CrStatusEnum.APPROVED,
                reviewedBy: userId
            }
        })
    }

    async rejectRequest(
        id: string,
        userId: string,
        tx?: PrismaService
    ) {
        const prismaClient = tx || this.prisma
        return await prismaClient.changeRequest.update({
            where: { id },
            data: {
                status: CrStatusEnum.REJECTED,
                reviewedBy: userId
            }
        })
    }
}