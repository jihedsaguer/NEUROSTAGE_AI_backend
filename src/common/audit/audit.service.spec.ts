import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { LoggerService } from '../logger/logger.service';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        LoggerService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log audit event', async () => {
    const mockAuditLog = {
      id: 'audit-123',
      action: 'CREATED_SUBJECT',
      userId: 'user-123',
      resourceType: 'Subject',
      resourceId: 'subject-456',
      changes: { title: 'Test Subject' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(),
    };

    jest.spyOn(auditLogRepository, 'create').mockReturnValue(mockAuditLog as any);
    jest.spyOn(auditLogRepository, 'save').mockResolvedValue(mockAuditLog);

    const result = await service.log(
      'CREATED_SUBJECT',
      'user-123',
      'Subject',
      'subject-456',
      { title: 'Test Subject' },
      '127.0.0.1',
      'Mozilla/5.0',
    );

    expect(result).toEqual(mockAuditLog);
    expect(auditLogRepository.save).toHaveBeenCalled();
  });

  it('should get audit trail for resource', async () => {
    const mockAuditLogs = [
      {
        id: 'audit-1',
        action: 'CREATED_SUBJECT',
        userId: 'user-123',
        resourceType: 'Subject',
        resourceId: 'subject-456',
        changes: null,
        createdAt: new Date(),
      },
      {
        id: 'audit-2',
        action: 'UPDATED_SUBJECT',
        userId: 'user-123',
        resourceType: 'Subject',
        resourceId: 'subject-456',
        changes: { title: 'Updated' },
        createdAt: new Date(),
      },
    ];

    jest.spyOn(auditLogRepository, 'find').mockResolvedValue(mockAuditLogs as any);

    const result = await service.getAuditTrail('Subject', 'subject-456');

    expect(result).toEqual(mockAuditLogs);
    expect(auditLogRepository.find).toHaveBeenCalledWith({
      where: { resourceType: 'Subject', resourceId: 'subject-456' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  it('should get user audit log', async () => {
    const mockAuditLogs = [];
    jest.spyOn(auditLogRepository, 'find').mockResolvedValue(mockAuditLogs);

    const result = await service.getUserAuditLog('user-123');

    expect(auditLogRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  });

  it('should get action audit log', async () => {
    const mockAuditLogs = [];
    jest.spyOn(auditLogRepository, 'find').mockResolvedValue(mockAuditLogs);

    const result = await service.getActionAuditLog('CREATED_SUBJECT');

    expect(auditLogRepository.find).toHaveBeenCalledWith({
      where: { action: 'CREATED_SUBJECT' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  });

  it('should handle audit logging errors', async () => {
    const loggerSpy = jest.spyOn(LoggerService.prototype, 'error');
    jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as any);
    jest
      .spyOn(auditLogRepository, 'save')
      .mockRejectedValue(new Error('Database error'));

    await expect(
      service.log('CREATED_SUBJECT', 'user-123', 'Subject', 'subject-456'),
    ).rejects.toThrow('Database error');
  });
});
