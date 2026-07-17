import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/overview')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getAdminOverview() {
    return this.analyticsService.getAdminOverview();
  }

  @Get('admin/subjects-by-level')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getSubjectsByLevel() {
    return this.analyticsService.getSubjectsByLevel();
  }

  @Get('admin/candidatures-timeline')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getCandidaturesTimeline() {
    return this.analyticsService.getCandidaturesTimeline();
  }

  @Get('admin/stages-per-university')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getStagesPerUniversity() {
    return this.analyticsService.getStagesPerUniversity();
  }

  @Get('admin/pending-actions')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getPendingActions() {
    return this.analyticsService.getPendingActions();
  }

  @Get('admin/recent-activity')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getRecentActivity() {
    return this.analyticsService.getRecentActivity();
  }

  // ─── Encadreur endpoints ──────────────────────────────────────────────────

  @Get('encadreur/overview')
  @Roles(SYSTEM_ROLES.ENCADRANT_PRO, SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getEncadreurOverview(@Request() req: any) {
    return this.analyticsService.getEncadreurOverview(req.user.id);
  }

  @Get('encadreur/my-students')
  @Roles(SYSTEM_ROLES.ENCADRANT_PRO, SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getEncadreurMyStudents(@Request() req: any) {
    return this.analyticsService.getEncadreurMyStudents(req.user.id);
  }

  @Get('encadreur/jalon-alerts')
  @Roles(SYSTEM_ROLES.ENCADRANT_PRO, SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
  async getEncadreurJalonAlerts(@Request() req: any) {
    return this.analyticsService.getEncadreurJalonAlerts(req.user.id);
  }

  // ─── Student endpoints ────────────────────────────────────────────────────

  @Get('student/overview')
  @Roles(SYSTEM_ROLES.STUDENT)
  async getStudentOverview(@Request() req: any) {
    return this.analyticsService.getStudentOverview(req.user.id);
  }
}
