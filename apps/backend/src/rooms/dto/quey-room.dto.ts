import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryRoomDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    minCapacity?: number;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    location?: string

    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true
        if (value === 'false') return false
        return value
    })
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') {
            return true
        } else {
            return false
        }
    })
    @IsBoolean()
    isAudit?: boolean;
}
