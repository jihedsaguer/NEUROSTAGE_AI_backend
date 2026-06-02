import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { JalonsService } from './jalons.service';
import { CreateJalonDto } from './dto/create-jalon.dto';
import { UpdateJalonDto } from './dto/update-jalon.dto';
import { ValidateJalonDto } from './dto/validate-jalon.dto';
import { AcadCommentDto } from './dto/acad-comment.dto';
import { SubmitLivrableDto } from './dto/submit-livrable.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Controller('jalons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JalonsController {
  constructor(private readonly jalonsService: JalonsService) {}

  // ─── Admin endpoints ──────────────────────────────────────────────────────────

  @Post()
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  createJalon(@Body() dto: CreateJalonDto, @Request() req) {
    return this.jalonsService.createJalon(dto, req.user);
  }

  // Static segment must come before parameterized :id routes
  @Get('stage/:stageId')
  getJalonsForStage(@Param('stageId') stageId: string, @Request() req) {
    return this.jalonsService.getJalonsForStage(stageId, req.user);
  }

  // ─── Sub-resource routes (must come before PATCH /:id) ───────────────────────

  @Patch(':id/validate')
  @Roles(SYSTEM_ROLES.ENCADRANT_PRO)
  validateJalon(@Param('id') id: string, @Body() dto: ValidateJalonDto, @Request() req) {
    return this.jalonsService.validateJalon(id, dto, req.user);
  }

  @Patch(':id/acad-comment')
  @Roles(SYSTEM_ROLES.ENCADRANT_ACADEMIQUE)
  addAcadComment(@Param('id') id: string, @Body() dto: AcadCommentDto, @Request() req) {
    return this.jalonsService.addAcadComment(id, dto, req.user);
  }

  @Post(':id/livrable')
  @Roles(SYSTEM_ROLES.STUDENT)
  submitLivrable(@Param('id') id: string, @Body() dto: SubmitLivrableDto, @Request() req) {
    return this.jalonsService.submitLivrable(id, dto, req.user);
  }

  @Get(':id/livrable')
  getLivrable(@Param('id') id: string, @Request() req) {
    return this.jalonsService.getLivrable(id, req.user);
  }

  // ─── Parameterized :id routes ─────────────────────────────────────────────────

  @Get(':id')
  getJalonById(@Param('id') id: string, @Request() req) {
    return this.jalonsService.getJalonById(id, req.user);
  }

  @Patch(':id')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  updateJalon(@Param('id') id: string, @Body() dto: UpdateJalonDto, @Request() req) {
    return this.jalonsService.updateJalon(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(204)
  deleteJalon(@Param('id') id: string, @Request() req): Promise<void> {
    return this.jalonsService.deleteJalon(id, req.user);
  }
}
