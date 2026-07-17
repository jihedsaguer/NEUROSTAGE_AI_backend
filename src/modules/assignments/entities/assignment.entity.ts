import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Assignment represents a pre-stage encadreur↔student mapping.
 * This is separate from Stage — it's used to pre-assign supervisors
 * to students before a formal stage is created.
 */
@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encadreur_id' })
  encadreur: User;

  @Column({ name: 'encadreur_id' })
  encadreurId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @CreateDateColumn()
  createdAt: Date;
}
