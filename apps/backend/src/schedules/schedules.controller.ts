import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleEnum } from '@prisma/client';
import { JwtPayload } from 'src/auth/dto/auth.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@UseGuards(JwtAuthGuard, RolesGuard)  // apply to all routes
@Controller('schedules')
export class SchedulesController {
  private readonly logger = new Logger("SchedulesController")
  constructor(
    private readonly schedulesService: SchedulesService,
  ) { }

  // GET /schedules — admins see all, users see own
  @Get()
  findAll(
    @Query() query: QueryScheduleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const isAdmin = user.role === RoleEnum.ADMIN;
    this.logger.log(`Received request to find schedules with query: ${JSON}`)

    return this.schedulesService.findAll(query, user.sub, isAdmin);
  }

  // GET /schedules/:id
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const isAdmin = user.role === RoleEnum.ADMIN;
    return this.schedulesService.findOne(id, user.sub, isAdmin);
  }

  // POST /schedules — ADMIN only
  @Post()
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createScheduleDto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(createScheduleDto, user.sub);
  }

  // PATCH /schedules/:id/status — ADMIN only (optimistic locking)
  @Patch(':id/status')
  @Roles(RoleEnum.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  // DELETE /schedules/:id — ADMIN only (soft cancel)
  @Delete(':id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.cancel(id);
  }

  //DELETE /schedule/:id - ADMIN only (hard cancel)
  @Delete(':id/permanent')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  hardCancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.remove(id);
  }
}