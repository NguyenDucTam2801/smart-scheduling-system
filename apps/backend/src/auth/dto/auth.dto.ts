import { IsEmail, IsEnum, IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { RoleEnum } from '@prisma/client';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    name!: string;
}

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password!: string;
}

export class JwtPayload {
    @IsString()
    @IsNotEmpty()
    sub!: string

    @IsEmail()
    @IsNotEmpty()
    email!: string

    @IsString()
    @IsNotEmpty()
    role!: RoleEnum
}

export class PromoteDto {
    @IsUUID()
    @IsNotEmpty()
    userId!: string;

    @IsEnum(RoleEnum)
    @IsNotEmpty()
    targetRole!: RoleEnum;

    @IsString()
    @IsNotEmpty()
    secretKey!: string;
}