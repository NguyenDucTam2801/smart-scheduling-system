import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { RoomRepository } from './rooms.repository';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TransactionManagerModule } from 'src/transaction-manager/transaction-manager.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule, TransactionManagerModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomRepository],
  exports: [RoomsService]
})
export class RoomsModule { }
