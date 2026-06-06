import { PartialType } from '@nestjs/mapped-types';
import { CreateScheduleDto } from './create-schedule.dto';
import { IsEnum, IsInt, IsNotEmpty, MinLength } from 'class-validator';
import { StatusEnum } from '@prisma/client';

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {
    @IsEnum(StatusEnum)
    @IsNotEmpty()
    status!: StatusEnum

    @IsInt()
    @MinLength(0)
    version!: number
}
