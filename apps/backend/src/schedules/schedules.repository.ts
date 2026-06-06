import { Injectable } from "@nestjs/common";
import { Prisma, StatusEnum } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";


@Injectable()
export class SchedulesRepository {
    constructor(private readonly prisma: PrismaService) { }

    //Find overlapping
    async findOverlappingSchedules(
        tx: Prisma.TransactionClient,
        roomId: string,
        startTime: Date,
        endTime: Date,
        excludeId?: string
    ) {
        return tx.schedule.findFirst({
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

    async updateStatusWithLock(
        id: string,
        status: StatusEnum,
        version: number,
    ): Promise<number> {
        // Returns number of affected rows — 0 means stale version
        const result = await this.prisma.$executeRaw`
      UPDATE schedules
      SET    status     = ${status}::"status_enum",
             version    = version + 1,
             updated_at = now()
      WHERE  id      = ${id}::uuid
        AND  version = ${version}
    `;
        return result;
    }

    async cancel(id: string) {
        return this.prisma.schedule.update({
            where: { id },
            data: { status: StatusEnum.CANCELLED },
        });
    }

    async findById(id: string) {
        return this.prisma.schedule.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } },
                room: { select: { id: true, name: true } },
            },
        });
    }

}