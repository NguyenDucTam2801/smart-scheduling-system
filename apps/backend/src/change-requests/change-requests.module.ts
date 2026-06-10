import { Module } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { ChangeRequestsController } from './change-requests.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { SchedulesModule } from 'src/schedules/schedules.module';
import { ChangeRequestsRepository } from './change-requests.repository';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SchedulesModule
  ],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService, ChangeRequestsRepository],
  exports: [ChangeRequestsService, ChangeRequestsRepository]

})
export class ChangeRequestsModule { }
