import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpStatus, HttpCode, Query, ParseUUIDPipe, Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RoleEnum } from '@prisma/client';
import { QueryRoomDto } from './dto/quey-room.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/dto/auth.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger("RoomsController")
  constructor(private readonly roomsService: RoomsService) { }

  // POST /rooms — ADMIN only
  @Post()
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.roomsService.create(createRoomDto, user.sub);
  }

  // GET /rooms — any authenticated user
  @Get()
  findAll(@Query() query: QueryRoomDto) {
    return this.roomsService.findAll(query);
  }

  // GET /rooms/:id — any authenticated user
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findOne(id);
  }

  // GET /rooms/:id — ADMIN only - check specific room
  @Get('/admin/:id')
  @Roles(RoleEnum.ADMIN)
  findOneAudit(@Param('id', ParseUUIDPipe) id: string) {
    const audit = true
    return this.roomsService.findOne(id, audit);
  }

  // PATCH /rooms/:id — ADMIN only
  @Patch(':id')
  @Roles(RoleEnum.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @CurrentUser() user: JwtPayload
  ) {
    this.logger.log("Patch route with body: ", updateRoomDto)
    return this.roomsService.update(id, updateRoomDto, user.sub);
  }

  // DELETE /rooms/:id — ADMIN only (soft delete)
  // @Delete(':id')
  // @Roles(RoleEnum.ADMIN)
  // @HttpCode(HttpStatus.OK)
  // softDelete(@Param('id', ParseUUIDPipe) id: string) {
  //   return this.roomsService.softDelete(id);
  // }

  // DELETE /rooms/:id/permanent — ADMIN only (hard delete)
  @Delete('/permanent/:id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    // this.logger.log("/DELETE with id: ", id)
    return this.roomsService.hardDelete(id);
  }
}
