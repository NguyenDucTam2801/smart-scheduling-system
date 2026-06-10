import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator"

export class CreateChangeRequestDto {
    @IsUUID()
    @IsNotEmpty()
    scheduleId!: string

    @IsOptional()
    @IsDateString()
    newStart?: string

    @IsOptional()
    @IsDateString()
    newEnd?: string

    @IsOptional()
    @IsString()
    reason?: string

}
