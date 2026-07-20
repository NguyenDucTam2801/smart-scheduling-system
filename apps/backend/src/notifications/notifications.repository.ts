import { Injectable } from '@nestjs/common';
import { NotifEnum } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Injectable()
export class NotificationsRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findMany(userId: string, query: QueryNotificationDto) {
        return this.prisma.notification.findMany({
            where: {
                ...(query.type === NotifEnum.SYSTEM_ANNOUNCEMENT && !userId && { userId: null }),
                ...(query.isRead !== undefined && { isRead: query.isRead }),
                ...(query.type && { type: query.type }),

            },
            orderBy: { sentAt: 'desc' },
        });
    }

    async findById(id: string) {
        return this.prisma.notification.findUnique({ where: { id } });
    }

    async countUnread(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    async markAsRead(id: string) {
        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async delete(id: string) {
        return this.prisma.notification.delete({ where: { id } });
    }


    // ── Broadcast create — all users ──────────────────────────────────
    async createForAllUsers(dto: Omit<CreateBroadcastDto, 'userIds'>, tx?: PrismaService) {
        // const users = await this.prisma.user.findMany({ select: { id: true } });

        const prismaClient = tx || this.prisma;

        return prismaClient.notification.create({
            data: {
                userId: undefined,
                title: dto.title,
                message: dto.message,
                type: dto.type,
            },
        });
    }

    // ── Broadcast create — specific users ─────────────────────────────
    async createForUsers(dto: CreateBroadcastDto, tx?: PrismaService) {
        const prismaClient = tx || this.prisma;

        return prismaClient.notification.createMany({
            data: dto.userIds?.map((userId) => ({
                userId,
                title: dto.title,
                message: dto.message,
                type: dto.type,
            })) ?? [],
        });
    }
}