import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StagesService } from './stages.service';
import { CreateStageDto, UpdateStageDto, AssignAcadDto, AssignProDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { Audit } from '../../common/audit/audit.decorator';

@Controller('stages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  // ─── Admin endpoints 
  @Post()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('CREATE_STAGE', 'Stage')
  createStage(@Body() dto: CreateStageDto) {
    return this.stagesService.createStage(dto);
  }

  @Get()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  getAllStages() {
    return this.stagesService.getAllStages();
  }

  @Patch(':id')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('UPDATE_STAGE', 'Stage')
  updateStage(@Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.stagesService.updateStage(id, dto);
  }

  @Patch(':id/assign-pro')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('ASSIGN_ENCADRANT_PRO', 'Stage')
  assignEncadrantPro(@Param('id') id: string, @Body() dto: AssignProDto) {
    return this.stagesService.assignEncadrantPro(id, dto);
  }

  @Patch(':id/assign-acad')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('ASSIGN_ENCADRANT_ACAD', 'Stage')
  assignEncadrantAcad(@Param('id') id: string, @Body() dto: AssignAcadDto) {
    return this.stagesService.assignEncadrantAcad(id, dto);
  }

  @Patch(':id/complete')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('COMPLETE_STAGE', 'Stage')
  completeStage(@Param('id') id: string) {
    return this.stagesService.completeStage(id);
  }

  @Patch(':id/cancel')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  @Audit('CANCEL_STAGE', 'Stage')
  cancelStage(@Param('id') id: string) {
    return this.stagesService.cancelStage(id);
  }

  // ─── Shared: get by ID (role-scoped visibility)

  @Get(':id')
  getStageById(@Param('id') id: string, @Request() req) {
    return this.stagesService.getStageById(id, req.user);
  }

  // ─── Student ─────────────────────────────────────────────────────────────────

  @Get('my/stage')
  @Roles(SYSTEM_ROLES.STUDENT)
  getMyStage(@Request() req) {
    return this.stagesService.getMyStage(req.user);
  }

  // ─── Encadrant Pro ───────────────────────────────────────────────────────────

  @Get('my/as-pro')
  @Roles(SYSTEM_ROLES.ENCADRANT_PRO)
  getMyStagesAsPro(@Request() req) {
    return this.stagesService.getMyStagesAsEncadrantPro(req.user);
  }

  // ─── Encadrant Académique ────────────────────────────────────────────────────

  @Get('my/as-acad')
  @Roles(SYSTEM_ROLES.ENCADRANT_ACADEMIQUE)
  getMyStagesAsAcad(@Request() req) {
    return this.stagesService.getMyStagesAsEncadrantAcad(req.user);
  }
}
