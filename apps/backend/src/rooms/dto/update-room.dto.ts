import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomDto } from './create-room.dto';
import { IsBoolean, IsOptional } from 'class-validator';
// import { Transform } from 'class-transformer';

export class UpdateRoomDto extends PartialType(CreateRoomDto) {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
