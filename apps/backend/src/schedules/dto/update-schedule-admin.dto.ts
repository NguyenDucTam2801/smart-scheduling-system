
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { UpdateScheduleUserDto } from './update-schedule-user.dto';

export class UpdateScheduleAdminDto extends PartialType(UpdateScheduleUserDto) {

    @IsOptional()
    @IsUUID()
    roomId?: string

    @IsOptional()
    @IsDateString()
    startTime?: string

    @IsOptional()
    @IsDateString()
    endTime?: string
}
