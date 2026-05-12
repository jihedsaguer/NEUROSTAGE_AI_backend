import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit/audit.service';
import { AUDIT_KEY, AuditMetadata } from '../audit/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.id;
    const ip: string = request.ip;
    const userAgent: string = request.headers['user-agent'];

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const resourceId: string = response?.id ?? 'unknown';
          await this.auditService.log(
            metadata.action,
            userId,
            metadata.resourceType,
            resourceId,
            null,
            ip,
            userAgent,
          );
        } catch (error) {
          console.error('[AuditInterceptor] Failed to log audit event:', error);
        }
      }),
    );
  }
}
