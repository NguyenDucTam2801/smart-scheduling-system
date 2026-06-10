import { IsDateString, IsNotEmpty, IsString, MinLength } from "class-validator"

export class CreateScheduleDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    title!: string

    @IsNotEmpty()
    @IsString()
    roomId!: string

    @IsNotEmpty()
    @IsDateString()
    startTime!: string

    @IsNotEmpty()
    @IsDateString()
    endTime!: string
}
