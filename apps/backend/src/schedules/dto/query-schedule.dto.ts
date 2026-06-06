import { StatusEnum } from "@prisma/client"
import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator"

export type CalendarView = 'day' | 'week' | 'month'

export class QueryScheduleDto {
    @IsOptional()
    view?: CalendarView

    @IsOptional()
    @IsDateString()
    date?: string

    @IsOptional()
    @IsUUID()
    roomId?: string

    @IsOptional()
    @IsUUID()
    userId?: string

    @IsOptional()
    @IsEnum(StatusEnum)
    status?: StatusEnum
}