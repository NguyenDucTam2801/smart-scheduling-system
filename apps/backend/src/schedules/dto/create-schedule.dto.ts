import { IsDateString, IsNotEmpty, IsString, MinLength } from "class-validator"

export class CreateScheduleDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    title!: string

    @IsString()
    @IsNotEmpty()
    userId!: string

    @IsString()
    @IsNotEmpty()
    roomId!: string

    @IsDateString()
    @IsNotEmpty()
    startTime!: string

    @IsDateString()
    @IsNotEmpty()
    endTime!: string
}
