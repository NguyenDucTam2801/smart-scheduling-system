import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { QueryRoomDto } from "./dto/quey-room.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";

@Injectable()
export class RoomRepository {
    constructor(
        private readonly prisma: PrismaService
    ) {
    }

    async findMany(query: QueryRoomDto) {
        const { name, minCapacity, location, isActive } = query;
        return await this.prisma.room.findMany({
            where: {
                ...(name && { name }),
                ...(minCapacity && { capacity: { gte: minCapacity } }),
                ...(location && { location }),
                ...(typeof isActive === 'boolean' && { isActive }),
            },
            orderBy: { name: "asc" }
        })

    }


    async findById(id: string, audit: boolean = false) {
        if (audit) {
            return await this.prisma.room.findUnique({
                where: {
                    id: id
                },
                include: {
                    schedules: true,
                    _count: {
                        select: {
                            schedules: true
                        }
                    }
                }
            })
        } else {
            return await this.prisma.room.findFirst({
                where: {
                    id: id
                }
            })
        }

    }


    async findByName(name: string) {
        return await this.prisma.room.findMany({
            where: {
                name: name
            }
        })
    }


    async create(dto: CreateRoomDto) {
        const { name, capacity, location } = dto
        // add notification table to all users about new room
        return this.prisma.room.create({
            data: {
                name,
                capacity,
                ...(location && { location })
            }
        })
    }
    async update(id: string, dto: UpdateRoomDto) {
        const { name, capacity, location, isActive } = dto
        return this.prisma.room.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(capacity && { capacity }),
                ...(location && { location }),
                ...(typeof isActive === "boolean" && { isActive }),

            }
        })
    }
    async softDelete(id: string) {
        return this.prisma.room.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async hardDelete(id: string) {
        // add notification table to all users about deleted room

        return this.prisma.room.delete({
            where: { id }
        })
    }


    async hasActiveSchedules(id: string): Promise<boolean> {
        const count = await this.prisma.schedule.count({
            where: {
                roomId: id,
                status: { in: ['PENDING', 'APPROVED'] },
            },
        });
        return count > 0;
    }

}