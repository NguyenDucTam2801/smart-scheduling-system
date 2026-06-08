import { Controller, Post, Body, UseGuards, Req, Get, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtPayload, LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

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
  @Get('refresh')
  refreshTokens(@Req() req: Request) {
    const user = req.user as { sub: string, email: string, role: string, refreshToken: string }
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  getUser(@CurrentUser() user: JwtPayload) {
    return user
  }

  @Patch('promote-admin')
  @HttpCode(HttpStatus.OK)
  async promoteToAdmin(
    @Body() body: { userId: string, secretKey: string }
  ) {
    const { userId, secretKey } = body
    this.authService.promoteToAdmin(userId, secretKey);
  }
}
