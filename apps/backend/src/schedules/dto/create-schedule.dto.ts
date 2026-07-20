import { IsDateString, IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

export class CreateScheduleDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    @MaxLength(255)
    title!: string

    @IsNotEmpty()
    @IsUUID()
    roomId!: string

    @IsNotEmpty()
    @IsDateString()
    startTime!: string

    @IsNotEmpty()
    @IsDateString()
    endTime!: string
}
