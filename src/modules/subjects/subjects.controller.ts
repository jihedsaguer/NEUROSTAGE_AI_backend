import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto, ValidateSubjectDto, QuerySubjectsFilterDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Roles(
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.STUDENT,
    SYSTEM_ROLES.SUPER_ADMIN,
    SYSTEM_ROLES.ADMIN_FORMATION,
  )
  async createSubject(
    @Body() createSubjectDto: CreateSubjectDto,
    @Request() req,
  ) {
    return await this.subjectsService.createSubject(
      createSubjectDto,
      req.user,
    );
  }

  @Get()
  async getAllSubjects(
    @Query() filter: QuerySubjectsFilterDto,
    @Request() req,
  ) {
    return await this.subjectsService.getAllSubjects(req.user, filter);
  }

  @Get('my')
  async getMySubjects(
    @Query() filter: QuerySubjectsFilterDto,
    @Request() req,
  ) {
    return await this.subjectsService.getMySubjects(req.user, filter);
  }

  @Get('pending')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getPendingSubjects() {
    return await this.subjectsService.getPendingSubjects();
  }

  @Get(':id')
  async getSubjectById(@Param('id') id: string, @Request() req) {
    return await this.subjectsService.getSubjectById(id, req.user);
  }

  @Put(':id')
  @Roles(
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.SUPER_ADMIN,
    SYSTEM_ROLES.ADMIN_FORMATION,
  )
  async updateSubject(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
    @Request() req,
  ) {
    return await this.subjectsService.updateSubject(
      id,
      updateSubjectDto,
      req.user,
    );
  }

  @Delete(':id')
  @Roles(
    SYSTEM_ROLES.ENCADRANT_PRO,
    SYSTEM_ROLES.SUPER_ADMIN,
    SYSTEM_ROLES.ADMIN_FORMATION,
  )
  async deleteSubject(@Param('id') id: string, @Request() req) {
    await this.subjectsService.deleteSubject(id, req.user);
    return { message: 'Subject deleted successfully' };
  }

  @Patch(':id/validate')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async validateSubject(
    @Param('id') id: string,
    @Body() validateSubjectDto: ValidateSubjectDto,
  ) {
    return await this.subjectsService.validateSubject(id, validateSubjectDto);
  }
}
