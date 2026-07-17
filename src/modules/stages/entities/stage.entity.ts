import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Candidature } from '../../candidatures/entities/candidature.entity';

export enum StageStatus {
  PENDING_ACAD = 'PENDING_ACAD', // waiting for academic supervisor assignment
  ACTIVE = 'ACTIVE',             // fully staffed, internship in progress
  COMPLETED = 'COMPLETED',       // internship finished
  CANCELLED = 'CANCELLED',       // cancelled by admin
}

@Entity('stages')
@Index(['studentId'])
@Index(['encadrantProId'])
@Index(['encadrantAcadId'])
@Index(['candidatureId'], { unique: true })
export class Stage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The accepted candidature that triggered this stage
  @ManyToOne(() => Candidature, (candidature) => candidature.stages, {
    nullable: false,
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidature_id' })
  candidature: Candidature;

  @Column({ name: 'candidature_id', unique: true })
  candidatureId: string;

  // The subject of the internship — load explicitly when needed
  @ManyToOne(() => Subject, { nullable: false, eager: false })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  // The student doing the internship — load explicitly when needed
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  // The professional supervisor — load explicitly when needed
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'encadrant_pro_id' })
  encadrantPro: User;

  @Column({ name: 'encadrant_pro_id' })
  encadrantProId: string;

  // The academic supervisor (assigned separately by admin) — load explicitly when needed
  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'encadrant_acad_id' })
  encadrantAcad: User | null;

  @Column({ name: 'encadrant_acad_id', nullable: true })
  encadrantAcadId: string | null;

  @Column({
    type: 'enum',
    enum: StageStatus,
    default: StageStatus.PENDING_ACAD,
  })
  status: StageStatus;

  @Column({ type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
