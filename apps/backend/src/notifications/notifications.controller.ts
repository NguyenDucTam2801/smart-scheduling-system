import {
    Controller, Get, Patch, Delete, Post,
    Body, Param, Query, UseGuards, ParseUUIDPipe,
    HttpCode, HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/dto/auth.dto';
import { RoleEnum } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    // GET /notifications
    @Get()
    findAll(
        @Query() query: QueryNotificationDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.notificationsService.findAll(user.sub, query);
    }

    // GET /notifications/unread-count
    @Get('unread-count')
    unreadCount(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.unreadCount(user.sub);
    }

    // PATCH /notifications/:id/read
    @Patch(':id/read')
    markAsRead(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.notificationsService.markAsRead(id, user.sub);
    }

    // PATCH /notifications/read-all
    @Patch('read-all')
    markAllAsRead(@CurrentUser() user: JwtPayload) {
        return this.notificationsService.markAllAsRead(user.sub);
    }

    // DELETE /notifications/:id
    @Delete(':id')
    @Roles(RoleEnum.SUPERADMIN)
    @HttpCode(HttpStatus.OK)
    remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.notificationsService.remove(id, user.sub);
    }

    // POST /notifications/broadcast — SUPERADMIN only
    @Post('broadcast')
    @Roles(RoleEnum.SUPERADMIN)
    @HttpCode(HttpStatus.CREATED)
    broadcast(@Body() dto: CreateBroadcastDto) {
        return this.notificationsService.broadcast(dto);
    }
}