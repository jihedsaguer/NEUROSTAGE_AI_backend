import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({  nullable: true })
  phone: string;

  @Column({ nullable: true })
  university: string;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

   @Column({ unique: true })
  userId: string;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  graduationYear: number;

  @Column('text', { array: true, default: [] })
  skills: string[];

  @Column({ default: 0 })
  completionPercentage: number;

  @Column({ default: false })
  isComplete: boolean;

  @Column({ nullable: true })
  cinLast3Digits: string;

  @Column({ nullable: true })
  cinHash: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
  })
  cinStatus: string;

  @Column({ default: false })
  isAiProcessed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
  



