import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsGateway,
  ],
  exports: [
    NotificationsGateway,    // ← other modules emit after commit
    // NotificationsService, // ← other modules create notifications in tx
    NotificationsRepository
  ],
})
export class NotificationsModule { }