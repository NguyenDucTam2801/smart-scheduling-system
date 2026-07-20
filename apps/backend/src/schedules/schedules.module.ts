import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TransactionManagerModule } from 'src/transaction-manager/transaction-manager.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesRepository } from './schedules.repository';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, TransactionManagerModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesRepository],
  exports: [SchedulesService, SchedulesRepository],
})
export class SchedulesModule { }