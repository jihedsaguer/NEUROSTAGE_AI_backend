import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit_metadata';

export interface AuditMetadata {
  action: string;
  resourceType: string;
}

/**
 * Decorator to mark a method for audit logging
 * Usage: @Audit('CREATED_SUBJECT')
 */
export const Audit = (action: string, resourceType: string = 'Unknown') =>
  SetMetadata(AUDIT_KEY, { action, resourceType });
