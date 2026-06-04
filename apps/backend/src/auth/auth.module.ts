import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenStrategy } from './strategies/accessToken.strategy';
import { RefreshTokenStrategy } from './strategies/refreshToken.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [JwtModule.register({}), PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy, RefreshTokenStrategy],
})
export class AuthModule { }
