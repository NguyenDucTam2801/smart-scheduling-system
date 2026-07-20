import { Injectable } from "@nestjs/common";
import { Prisma, StatusEnum } from "@prisma/client";
import { setClauses } from "src/common/utils/set-clauses.util";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { QueryScheduleAdminDto } from "./dto/query-schedule-admin.dto";
import { QueryScheduleUserDto } from "./dto/query-schedule-user.dto";
import { UpdateScheduleAdminDto } from "./dto/update-schedule-admin.dto";
import { UpdateScheduleUserDto } from "./dto/update-schedule-user.dto";


@Injectable()
export class SchedulesRepository {
    constructor(private readonly prisma: PrismaService) { }

    //Find overlapping
    async findOverlappingSchedules(
        roomId: string,
        startTime: Date | string,
        endTime: Date | string,
        excludeId?: string,
        tx?: PrismaService,
    ) {
        const prismaClient = tx || this.prisma;
        return prismaClient.schedule.findFirst({
            where: {
                roomId,
                status: { notIn: [StatusEnum.CANCELLED, StatusEnum.REJECTED] },
                startTime: { lt: endTime },
                endTime: { gt: startTime },
                ...(excludeId && { id: { not: excludeId } })
            },
            select: { id: true, startTime: true, endTime: true, title: true }
        })
    }

    async updateForAdminWithLock(
        id: string,
        updateScheduleDto: UpdateScheduleAdminDto,
        tx?: PrismaService
    ): Promise<number> {
        // Returns number of affected rows — 0 means stale version
        const { title, status, startTime, endTime, roomId } = updateScheduleDto
        const clauses = setClauses({
            title, status, startTime, endTime, roomId
        })
        const prismaClient = tx || this.prisma;

        const result = await prismaClient.$executeRaw`
      UPDATE schedules
      SET    ${Prisma.raw(clauses)}
      WHERE  id      = ${id}::uuid
        AND  version = ${updateScheduleDto.version}
    `;
        return result;
    }

    async updateForUserWithLock(
        id: string,
        updateScheduleDto: UpdateScheduleUserDto,
        tx?: PrismaService
    ): Promise<number> {
        // Returns number of affected rows — 0 means stale version
        const { title, status } = updateScheduleDto
        const clauses = setClauses({
            title, status
        })
        const prismaClient = tx || this.prisma;
        // console.log(`clauses:${clauses}`);
        const result = await prismaClient.$executeRaw`
      UPDATE schedules
      SET    ${Prisma.raw(clauses)}
      WHERE  id      = ${id}::uuid
        AND  version = ${updateScheduleDto.version}
    `;
        return result;
    }


    async findById(id: string, tx: PrismaService = this.prisma) {
        return tx.schedule.findUnique({
            where: { id },
            include: {
                user: { select: { name: true, email: true } },
                room: { select: { name: true, location: true } },
            },
        });
    }

    async findMany(
        query: QueryScheduleUserDto | QueryScheduleAdminDto,
        userId?: string,
        tx: PrismaService = this.prisma
    ) {
        return tx.schedule.findMany({
            where: {
                ...query,
                ...(userId && { userId })
            }
        })
    }

    async create(
        createScheduleDto: CreateScheduleDto,
        userId: string,
        tx: PrismaService,
    ) {
        const prismaClient = tx || this.prisma
        return prismaClient.schedule.create({
            data: {
                ...createScheduleDto,
                userId,
            }
        });
    }

    async delete(id: string, tx?: PrismaService) {
        const prismaClient = tx || this.prisma;
        return prismaClient.schedule.delete({
            where: { id }
        })
    }
}


