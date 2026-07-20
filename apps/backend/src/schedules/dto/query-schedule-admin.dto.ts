import { PartialType } from "@nestjs/mapped-types";
import { QueryScheduleUserDto } from "./query-schedule-user.dto";
import { IsOptional, IsUUID } from "class-validator";

export class QueryScheduleAdminDto extends PartialType(QueryScheduleUserDto) {
    @IsOptional()
    @IsUUID()
    userId?: string;
}