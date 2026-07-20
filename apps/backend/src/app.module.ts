import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config'; // <-- Thêm dòng này
import { SchedulesModule } from './schedules/schedules.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChangeRequestsModule } from './change-requests/change-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TransactionManagerModule } from './transaction-manager/transaction-manager.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    SchedulesModule,
    RoomsModule,
    ChangeRequestsModule,
    NotificationsModule,
    TransactionManagerModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }])],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    }
  ],
})
export class AppModule { }
