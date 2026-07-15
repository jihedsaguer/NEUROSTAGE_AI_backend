import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditLog } from './audit.entity';
import { LoggerService } from '../logger/logger.service';

export interface PaginatedAuditResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private logger: LoggerService,
  ) {}

  /**
   * Log an audit event
   */
  async log(
    action: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    changes?: any,
    ip?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        action,
        userId,
        resourceType,
        resourceId,
        changes,
        ip,
        userAgent,
      });

      const saved = await this.auditLogRepository.save(auditLog);
      this.logger.debug(`Audit logged: ${action} on ${resourceType} (${resourceId})`, {
        userId,
        actionId: saved.id,
      });

      return saved;
    } catch (error) {
      this.logger.error('Failed to log audit event', error, {
        action,
        userId,
        resourceType,
        resourceId,
      });
      throw error;
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async getAuditTrail(
    resourceType: string,
    resourceId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLog(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific action
   */
  async getActionAuditLog(action: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Paginated, filterable audit log — used by the Admin Audit Center.
   */
  async getAllAuditLogs(params: {
    page?: number;
    limit?: number;
    search?: string;
    action?: string;
    resourceType?: string;
    userId?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedAuditResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 25);
    const skip = (page - 1) * limit;

    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (params.search) {
      qb.andWhere(
        '(log.action ILIKE :search OR log.userId ILIKE :search OR log.resourceType ILIKE :search OR log.resourceId ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    if (params.action) {
      qb.andWhere('log.action ILIKE :action', { action: `%${params.action}%` });
    }

    if (params.resourceType) {
      qb.andWhere('log.resourceType = :resourceType', { resourceType: params.resourceType });
    }

    if (params.userId) {
      qb.andWhere('log.userId = :userId', { userId: params.userId });
    }

    if (params.from) {
      qb.andWhere('log.createdAt >= :from', { from: new Date(params.from) });
    }

    if (params.to) {
      qb.andWhere('log.createdAt <= :to', { to: new Date(params.to) });
    }

    qb.orderBy('log.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
