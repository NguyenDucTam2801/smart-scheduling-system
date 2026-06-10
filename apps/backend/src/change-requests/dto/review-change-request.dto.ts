import { IsEnum, IsNotEmpty } from 'class-validator';
import { CrStatusEnum } from '@prisma/client';

export class ReviewChangeRequestDto {
    @IsEnum(CrStatusEnum)
    @IsNotEmpty()
    status!: CrStatusEnum
}
