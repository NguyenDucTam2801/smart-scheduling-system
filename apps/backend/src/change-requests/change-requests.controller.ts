import { Controller, Get, Post, Body, Patch, Param, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/dto/auth.dto';
import { RoleEnum } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import { QueryChangeRequestUserDto } from './dto/query-change-request-user.dto';
import { QueryChangeRequestAdminDto } from './dto/query-change-request-admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('change-requests')
export class ChangeRequestsController {
  constructor(private readonly changeRequestsService: ChangeRequestsService) { }

  // POST /change-requests — any authenticated user
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createChangeRequestDto: CreateChangeRequestDto, @CurrentUser() user: JwtPayload) {
    return this.changeRequestsService.create(createChangeRequestDto, user.sub);
  }


  @Get()
  findAllForUser(
    @Query() query: QueryChangeRequestUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.changeRequestsService.findAllForUser(query, user.sub);
  }

  @Get('/admin')
  @Roles(RoleEnum.ADMIN)
  findAllForAdmin(
    @Query() query: QueryChangeRequestAdminDto,
  ) {
    return this.changeRequestsService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isAdmin = user.role === RoleEnum.ADMIN
    return this.changeRequestsService.findOne(id, user.sub, isAdmin);
  }

  @Patch('/review/:id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() updateChangeRequestDto: ReviewChangeRequestDto, @CurrentUser() user: JwtPayload) {
    return this.changeRequestsService.review(id, updateChangeRequestDto, user.sub);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.changeRequestsService.remove(+id);
  // }
}
