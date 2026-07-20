import { StatusEnum } from "@prisma/client"
import { IsDateString, IsEnum, IsOptional, IsUUID, IsString, IsInt } from "class-validator"

export type CalendarView = 'day' | 'week' | 'month'

export class QueryScheduleUserDto {
    @IsOptional()
    view?: CalendarView

    @IsOptional()
    @IsDateString()
    date?: string

    @IsOptional()
    @IsUUID()
    roomId?: string

    @IsOptional()
    @IsEnum(StatusEnum)
    status?: StatusEnum

    @IsOptional()
    @IsString()
    title?: string

    @IsOptional()
    @IsInt()
    version?: number

}