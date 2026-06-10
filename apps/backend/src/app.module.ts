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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    SchedulesModule,
    RoomsModule,
    ChangeRequestsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
