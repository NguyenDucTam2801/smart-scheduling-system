import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  @Post('signup')
  signup(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  refreshTokens(@Req() req: Request) {
    const user = req.user as { sub: string, email: string, role: string, refreshToken: string }
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

}
