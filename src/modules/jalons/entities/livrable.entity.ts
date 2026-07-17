import {
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { Jalon } from './jalon.entity';
import { User } from '../../users/entities/user.entity';

@Entity('livrables')
export class Livrable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Jalon, (j) => j.livrable, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jalon_id' })
  jalon: Jalon;

  @Column({ name: 'jalon_id', unique: true })
  jalonId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 2048 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 100 })
  fileType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'varchar', length: 64, select: false })
  hash: string; // SHA-256, exclu des SELECT par défaut

  @Column({ type: 'boolean', default: false })
  scanOk: boolean;

  @Column({ type: 'text', nullable: true })
  studentNote: string | null;

  @Column({ type: 'timestamp' })
  submittedAt: Date;
}
