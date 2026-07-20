// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, PromoteDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { RoleEnum } from '@prisma/client';
import { AuthRepository } from './auth.repository';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersRepo: AuthRepository, // 🚀 Repo phục vụ dữ liệu
        private readonly jwtService: JwtService
    ) { }

    // ── REGISTER ───────────────────────────────────────────────────────
    async register(registerDto: RegisterDto): Promise<void> {
        const { email, password } = registerDto;

        const user = await this.usersRepo.findByEmail(email);
        if (user) throw new BadRequestException('Email already registered');

        const saltRounds = process.env.NODE_ENV === 'test' ? 1 : 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await this.usersRepo.createUser(registerDto, hashedPassword);

        // const tokens = await this.getTokens(user.id, user.email, user.role);
        // await this.saveRefreshToken(user.id, tokens.refreshToken);

        // return tokens;
    }

    // ── LOGIN ──────────────────────────────────────────────────────────
    async login(loginDto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        const { email, password } = loginDto;

        const user = await this.usersRepo.findByEmail(email);
        if (!user) throw new UnauthorizedException("Invalid Credentials");

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) throw new UnauthorizedException("Invalid Credentials");

        const tokens = await this.getTokens(user.id, user.email, user.role);
        // await this.saveRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    // ── REFRESH TOKENS ─────────────────────────────────────────────────
    async refreshTokens(userId: string, refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
        const user = await this.usersRepo.findById(userId);
        if (!user || !user.refreshTokenHash) throw new UnauthorizedException("Invalid Credentials");

        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
        if (!refreshTokenMatches) throw new UnauthorizedException("Invalid Credentials");

        const tokens = await this.getTokens(user.id, user.email, user.role);
        // await this.saveRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    // ── PROMOTE ROLE ───────────────────────────────────────────────────
    async promote(promoteDto: PromoteDto) {
        const { userId, targetRole, secretKey } = promoteDto;

        const user = await this.usersRepo.findById(userId);
        if (!user) throw new NotFoundException("User not found");

        if (targetRole === RoleEnum.USER) {
            throw new BadRequestException('Target role cannot be USER');
        }

        const expectedSecret = targetRole === RoleEnum.SUPERADMIN
            ? process.env.SUPER_ADMIN_SECRET_KEY
            : process.env.ADMIN_SECRET_KEY;

        if (secretKey !== expectedSecret) {
            throw new UnauthorizedException('Invalid secret key');
        }

        return this.usersRepo.updateRole(userId, targetRole);
    }

    // ── HELPER FUNCTIONS ───────────────────────────────────────────────
    private async getTokens(userId: string, email: string, role: RoleEnum): Promise<{ accessToken: string, refreshToken: string }> {
        const jwtPayload = { sub: userId, email, role };

        const accessToken = await this.jwtService.signAsync(
            jwtPayload, {
                secret: process.env.JWT_ACCESS_SECRET as string,
                // Just pass the string directly, and use '1h' (not '3600') as the fallback
                expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '1h') as any

            } as any);// Ensure this runs in the next tick to avoid blocking

        const refreshToken = await this.jwtService.signAsync(jwtPayload, {
            secret: process.env.JWT_REFRESH_SECRET as string,
            expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '1w') as any
        });

        await this.saveRefreshToken(userId, refreshToken);
        return { accessToken, refreshToken };
    }

    async logOut(userId: string): Promise<void> {
        await this.saveRefreshToken(userId, null);
    }

    private async saveRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        const tokenHash = refreshToken ? await bcrypt.hash(refreshToken, 12) : null;
        await this.usersRepo.updateRefreshTokenHash(userId, tokenHash);
    }


}