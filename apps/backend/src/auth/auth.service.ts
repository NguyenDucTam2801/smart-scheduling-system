import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { RoleEnum } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService
    ) { }
    // register, login, refresh tokens, get tokens, update refresh token

    //register a new user, hash the password, save to db, return access and refresh tokens
    async register(registerDto: RegisterDto): Promise<{ accessToken: string, refreshToken: string }> {
        const { email, password, name } = registerDto;
        const existingUser = await this.prisma.user.findUnique({ where: { email: email } })
        if (existingUser) throw new BadRequestException('Email already registered')

        const hashedPassword = await bcrypt.hash(password, 12)
        const user = await this.prisma.user.create({
            data: {
                email: email,
                name: name,
                passwordHash: hashedPassword,
                role: RoleEnum.USER
            }
        })

        const tokens = await this.getTokens(user.id, user.email, user.role)
        await this.updateRefreshToken(user.id, tokens.refreshToken)
        return tokens

    }

    //login user, verify password, return access and refresh tokens
    async login(loginDto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        const { email, password } = loginDto
        const existingUser = await this.prisma.user.findUnique({ where: { email: email } })
        if (!existingUser) throw new UnauthorizedException("Invalid Credentials")

        const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash)
        if (!passwordMatches) throw new UnauthorizedException("Invalid Credentials")

        const tokens = await this.getTokens(existingUser.id, existingUser.email, existingUser.role)
        await this.updateRefreshToken(existingUser.id, tokens.refreshToken)
        return tokens
    }

    // refresh tokens, verify user exists, generate new tokens, update refresh token in db, return new tokens
    async refreshTokens(userId: string, refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
        const existingUser = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!existingUser || !existingUser.refreshTokenHash) throw new UnauthorizedException("Invalid Credentials")

        const refreshTokenMatches = await bcrypt.compare(refreshToken, existingUser.refreshTokenHash);
        if (!refreshTokenMatches) throw new UnauthorizedException("Invalid Credentials");

        const tokens = await this.getTokens(existingUser.id, existingUser.email, existingUser.role, refreshToken)
        await this.updateRefreshToken(existingUser.id, tokens.refreshToken)
        return tokens
    }

    // helper function to generate access and refresh tokens
    private async getTokens(userId: string, email: string, role: RoleEnum, oldRefreshToken?: string): Promise<{ accessToken: string, refreshToken: string }> {
        const jwtPayload = { sub: userId, email, role }

        const accessToken = await this.jwtService.signAsync(jwtPayload, {
            secret: process.env.JWT_ACCESS_SECRET,
            expiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || '3600')
        }); // Ensure this runs in the next tick to avoid blocking


        const refreshToken = oldRefreshToken
            ? oldRefreshToken
            : await this.jwtService.signAsync(jwtPayload, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '86400')
            });

        return { accessToken, refreshToken }
    }

    private async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {

        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: refreshToken ? await bcrypt.hash(refreshToken, 12) : null }
        })


    }
}
