import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
  ) { }

  // ── GET own notifications ─────────────────────────────────────────
  async findAll(userId: string, query: QueryNotificationDto) {
    return this.notificationsRepo.findMany(userId, query);
  }

  async unreadCount(userId: string) {
    const count = await this.notificationsRepo.countUnread(userId);
    return { unreadCount: count };
  }

  // ── Mark one as read ───────────────────────────────────────────────
  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationsRepo.findById(id);
    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.notificationsRepo.markAsRead(id);
  }

  // ── Mark all as read ───────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    await this.notificationsRepo.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  // ── Delete own notification ─────────────────────────────────────────
  async remove(id: string, userId: string) {
    const notification = await this.notificationsRepo.findById(id);
    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.notificationsRepo.delete(id);
  }

  // ── SUPERADMIN broadcast / auto broadcast ─────────────────────────────────────────────
  async broadcast(dto: CreateBroadcastDto) {

    if (dto.userIds && dto.userIds.length > 0) {
      // Send to specific users
      await this.notificationsRepo.createForUsers(dto);
      this.gateway.notifyUsers(dto.userIds, dto);
      return { message: `Notification sent to ${dto.userIds.length} user(s)` };
    }

    // Send to ALL users
    await this.notificationsRepo.createForAllUsers(dto);
    this.gateway.notifyAll(dto);
    return { message: 'Notification broadcast to all users' };
  }

}