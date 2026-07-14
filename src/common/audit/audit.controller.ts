import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../../modules/roles/constants/roles.constants';

interface PaginatedAuditResponse {
  data: AuditLogResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN_FORMATION)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // GET /audit/resource/:type/:id?limit=50
  @Get('resource/:type/:id')
  async getAuditTrail(
    @Param('type') resourceType: string,
    @Param('id') resourceId: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.auditService.getAuditTrail(resourceType, resourceId, limit);
    return AuditLogResponseDto.fromEntities(logs);
  }

  // GET /audit/user/:userId?limit=100
  @Get('user/:userId')
  async getUserAuditLog(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.auditService.getUserAuditLog(userId, limit);
    return AuditLogResponseDto.fromEntities(logs);
  }

  // GET /audit/action/:action?limit=100
  @Get('action/:action')
  async getActionAuditLog(
    @Param('action') action: string,
    @Query('limit') limit?: number,
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.auditService.getActionAuditLog(action, limit);
    return AuditLogResponseDto.fromEntities(logs);
  }

  // GET /audit?search=&action=&resourceType=&userId=&from=&to=&page=1&limit=25
  @Get()
  async getAllAuditLogs(
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedAuditResponse> {
    const result = await this.auditService.getAllAuditLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      search,
      action,
      resourceType,
      userId,
      from,
      to,
    });
    return {
      ...result,
      data: AuditLogResponseDto.fromEntities(result.data),
    };
  }
}
