import { Module } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsController } from './change-requests.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { SchedulesModule } from 'src/schedules/schedules.module';
import { ChangeRequestsRepository } from './change-requests.repository';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TransactionManagerModule } from 'src/transaction-manager/transaction-manager.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SchedulesModule,
    NotificationsModule,
    TransactionManagerModule
  ],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService, ChangeRequestsRepository],
  exports: [ChangeRequestsService, ChangeRequestsRepository]

})
export class ChangeRequestsModule { }
