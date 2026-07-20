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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleEnum } from '@prisma/client';
import { JwtPayload } from 'src/auth/dto/auth.dto';
import { QueryScheduleAdminDto } from './dto/query-schedule-admin.dto';
import { QueryScheduleUserDto } from './dto/query-schedule-user.dto';
import { UpdateScheduleUserDto } from './dto/update-schedule-user.dto';
import { UpdateScheduleAdminDto } from './dto/update-schedule-admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)  // apply to all routes
@Controller('schedules')
export class SchedulesController {
  private readonly logger = new Logger("SchedulesController")
  constructor(
    private readonly schedulesService: SchedulesService,
  ) { }

  // GET /schedules — users see own
  @Get()
  findAll(
    @Query() query: QueryScheduleUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    this.logger.log(`Received request to find schedules with query: ${JSON}`)

    return this.schedulesService.findAllForUser(query, user.sub);
  }

  @Get('/admin')
  @Roles(RoleEnum.ADMIN)
  findAllForAdmin(
    @Query() query: QueryScheduleAdminDto,
  ) {
    // this.logger.log(`Received request to find schedules with query: ${JSON}`)

    return this.schedulesService.findAllForAdmin(query);
  }

  // GET /schedules/:id
  @Get(':id')
  @HttpCode(HttpStatus.FOUND)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const isAdmin = user.role === RoleEnum.ADMIN;
    return this.schedulesService.findOne(id, user.sub, isAdmin);
  }

  // POST /schedules
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createScheduleDto: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.create(createScheduleDto, user.sub);
  }

  // PATCH /schedules/:id— User change their own schedule
  @Patch(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  updateStatusForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleUserDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.schedulesService.updateForUser(id, updateScheduleDto, user.sub);
  }

  @Patch('/admin/:id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  updateStatusForAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleAdminDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.schedulesService.updateForAdmin(id, updateScheduleDto, user.sub);
  }


  //DELETE /schedule/:id - ADMIN only (hard cancel)
  @Delete('/permanent/:id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  hardCancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload
  ) {
    return this.schedulesService.delete(id, user.sub);
  }
}