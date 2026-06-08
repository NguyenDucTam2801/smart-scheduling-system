import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateRoomDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    name!: string

    @IsNotEmpty()
    @IsInt()
    @Min(1)
    capacity!: number

    @IsOptional()
    @IsString()
    @MaxLength(255)
    location?: string

}
