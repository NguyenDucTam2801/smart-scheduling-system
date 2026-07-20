import { NotifEnum } from '@prisma/client';
import {
    IsString, IsNotEmpty, IsOptional,
    IsArray, IsUUID, MaxLength,
    IsEnum,
} from 'class-validator';

export class CreateBroadcastDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title!: string;

    @IsString()
    @IsNotEmpty()
    message!: string;

    // If omitted → broadcast to ALL users
    // If provided → send only to these user ids
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    userIds?: string[];

    @IsEnum(NotifEnum)
    @IsNotEmpty()
    type!: NotifEnum
}