import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, LoggerService],
  exports: [AuditService],
})
export class AuditModule {}
