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
import { Stage } from '../../stages/entities/stage.entity';
import { User } from '../../users/entities/user.entity';
import { Livrable } from './livrable.entity';

export enum JalonStatus {
  PENDING   = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VALIDATED = 'VALIDATED',
  REJECTED  = 'REJECTED',
  LATE      = 'LATE', // calculé dynamiquement, jamais persisté
}

@Entity('jalons')
@Index(['stageId', 'order'], { unique: true })
export class Jalon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Stage, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @Column({ name: 'stage_id' })
  stageId: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'enum', enum: JalonStatus, default: JalonStatus.PENDING })
  status: JalonStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validated_by' })
  validatedBy: User | null;

  @Column({ name: 'validated_by', nullable: true })
  validatedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  proComment: string | null;

  @Column({ type: 'text', nullable: true })
  acadComment: string | null;

  @OneToOne(() => Livrable, (l) => l.jalon, { cascade: true, eager: false })
  livrable: Livrable | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
