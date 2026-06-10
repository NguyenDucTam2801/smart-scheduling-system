import { Controller, Get, Post, Body, Patch, Param, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/dto/auth.dto';
import { QueryChangeRequestDto } from './dto/query-change-request.dto';
import { RoleEnum } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';

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
  findAll(
    @Query() query: QueryChangeRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const isAdmin = user.role === RoleEnum.ADMIN
    return this.changeRequestsService.findAll(query, user.sub, isAdmin);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isAdmin = user.role === RoleEnum.ADMIN
    return this.changeRequestsService.findOne(id, user.sub, isAdmin);
  }

  @Patch(':id/review')
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
