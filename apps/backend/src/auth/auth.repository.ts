// src/auth/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleEnum, User } from '@prisma/client';
import { RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async createUser(dto: RegisterDto, hashedPassword: string): Promise<User> {
        return this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                passwordHash: hashedPassword,
                role: RoleEnum.USER,
            },
        });
    }

    async updateRefreshTokenHash(userId: string, tokenHash: string | null): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: tokenHash },
        });
    }

    async updateRole(userId: string, targetRole: RoleEnum) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { role: targetRole },
            select: { id: true, email: true, role: true },
        });
    }
}