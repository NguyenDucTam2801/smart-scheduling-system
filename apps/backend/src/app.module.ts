import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config'; // <-- Thêm dòng này

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
