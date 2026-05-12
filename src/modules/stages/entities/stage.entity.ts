import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
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
@Index(['student'])
@Index(['encadrantPro'])
@Index(['encadrantAcad'])
@Index(['candidatureId'], { unique: true })
export class Stage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The accepted candidature that triggered this stage
  @ManyToOne(() => Candidature, (candidature) => candidature.stages, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidature_id' })
  candidature: Candidature;

  @Column({ name: 'candidature_id', unique: true })
  candidatureId: string;

  // The subject of the internship
  @ManyToOne(() => Subject, { nullable: false, eager: true })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  // The student doing the internship
  @ManyToOne(() => User, { nullable: false, eager: true })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  // The professional supervisor (auto-set from subject.createdBy)
  @ManyToOne(() => User, { nullable: false, eager: true })
  @JoinColumn({ name: 'encadrant_pro_id' })
  encadrantPro: User;

  @Column({ name: 'encadrant_pro_id' })
  encadrantProId: string;

  // The academic supervisor (assigned separately by admin)
  @ManyToOne(() => User, { nullable: true, eager: true })
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
