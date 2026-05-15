import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { LoggerService } from '../logger/logger.service';

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
}
