import { StatusEnum } from "@prisma/client"
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class UpdateScheduleUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(255)
    title?: string

    @IsOptional()
    @IsEnum(StatusEnum)
    status?: StatusEnum


    @IsNotEmpty()
    @IsInt()
    version!: number
}