import { AuditLog } from '../audit.entity';

export class AuditLogResponseDto {
  id: string;
  action: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  changes: any | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;

  static fromEntity(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.action = log.action;
    dto.userId = log.userId;
    dto.resourceType = log.resourceType;
    dto.resourceId = log.resourceId;
    dto.changes = log.changes ?? null;
    dto.ip = log.ip ?? null;
    dto.userAgent = log.userAgent ?? null;
    dto.createdAt = log.createdAt;
    return dto;
  }

  static fromEntities(logs: AuditLog[]): AuditLogResponseDto[] {
    return logs.map((log) => AuditLogResponseDto.fromEntity(log));
  }
}
