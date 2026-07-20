import { PartialType } from "@nestjs/mapped-types";
import { QueryChangeRequestUserDto } from "./query-change-request-user.dto";
import { IsOptional, IsUUID } from "class-validator";

export class QueryChangeRequestAdminDto extends PartialType(QueryChangeRequestUserDto) {
    @IsOptional()
    @IsUUID()
    requesterId?: string;
}