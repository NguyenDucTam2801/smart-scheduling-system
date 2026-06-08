import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleDto } from './create-schedule.dto';
import { IsEnum, IsInt, IsOptional, MinLength } from 'class-validator';
import { StatusEnum } from '@prisma/client';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
    @IsOptional()
    @IsEnum(StatusEnum)
    status!: StatusEnum

    @IsInt()
    @MinLength(0)
    version!: number

}
