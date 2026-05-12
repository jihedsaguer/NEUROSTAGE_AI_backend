import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { StudentProfile } from './profiles.entity';

@Entity('student_documents')
export class StudentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  profile: StudentProfile;

  @Column()
  profileId: string;

  @Column({
    type: 'enum',
    enum: ['CV', 'TRANSCRIPT', 'CERTIFICATE', 'CIN', 'OTHER'],
  })
  type: string;

  // 📁 FILE INFO
  @Column()
  fileName: string;

  @Column()
  fileUrl: string;

  @Column()
  fileType: string;

  @Column()
  size: number;

  @Column({ nullable: true })
  hash: string;

  @Column({ default: false })
  scanOk: boolean;

  // 📅
  @CreateDateColumn()
  createdAt: Date;
}