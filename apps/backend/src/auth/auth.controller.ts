import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload, LoginDto, PromoteDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 ngày
      path: "/auth/refresh",
    });

    return {
      accessToken: tokens.accessToken,
    };
  }

  @UseGuards(AuthGuard('jwt-refresh'))
  @Get('refresh')
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as { sub: string, email: string, role: string, refreshToken: string }
    const tokens = await this.authService.refreshTokens(user.sub, user.refreshToken);
    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 ngày
      path: "/auth/refresh",
    });

    return {
      accessToken: tokens.accessToken,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user')
  async getUser(@CurrentUser() user: JwtPayload) {
    return user
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logOut(@CurrentUser() user: JwtPayload) {
    return await this.authService.logOut(user.sub);
  }

  @Patch('promote-admin')
  @HttpCode(HttpStatus.OK)
  async promoteToAdmin(
    @Body() body: PromoteDto
  ) {
    return await this.authService.promote(body);
  }
}
