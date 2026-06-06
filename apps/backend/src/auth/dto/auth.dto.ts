import { IsEmail, IsString, MinLength } from 'class-validator';
import { RoleEnum } from '@prisma/client';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsString()
    @MinLength(2)
    name!: string;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;
}

export class JwtPayload {
    @IsString()
    sub!: string

    @IsEmail()
    email!: string

    @IsString()
    role!: RoleEnum
}