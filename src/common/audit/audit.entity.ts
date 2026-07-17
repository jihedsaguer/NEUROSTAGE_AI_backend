import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['action'])
@Index(['userId'])
@Index(['resourceType', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // e.g., 'CREATED_SUBJECT', 'UPDATED_SUBJECT', 'DELETED_SUBJECT'

  @Column()
  userId: string; // Who performed the action

  @Column()
  resourceType: string; // e.g., 'Subject', 'Candidature', 'User'

  @Column()
  resourceId: string; // Which resource (ID, not name)

  @Column('jsonb', { nullable: true })
  changes: any; // What changed (old → new)

  @Column({ nullable: true })
  ip: string; // IP address of requester

  @Column({ nullable: true })
  userAgent: string; // User agent string

  @CreateDateColumn()
  createdAt: Date;
}
