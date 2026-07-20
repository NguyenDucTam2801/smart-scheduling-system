import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotifEnum } from '@prisma/client';

export class QueryNotificationDto {
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isRead?: boolean;

    @IsOptional()
    @IsEnum(NotifEnum)
    type?: NotifEnum;
}