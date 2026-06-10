import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { CrStatusEnum } from '@prisma/client';

export class QueryChangeRequestDto {
    @IsOptional()
    @IsEnum(CrStatusEnum)
    status?: CrStatusEnum;

    @IsOptional()
    @IsUUID()
    scheduleId?: string;

    @IsOptional()
    @IsUUID()
    requesterId?: string;


    @IsOptional()
    @IsUUID()
    reviewedBy?: string;
}