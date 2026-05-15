import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Candidature } from '../../candidatures/entities/candidature.entity';

export enum SubjectStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  title: string;

  @Column('text')
  description: string;

  @Column('simple-array', { nullable: true })
  technologies: string[];

  @Column({ nullable: true })
  level: string; 

  @Column('text', { nullable: true })
  prerequisites: string;

  @Column({
    type: 'enum',
    enum: SubjectStatus,
    default: SubjectStatus.DRAFT,
  })
  status: SubjectStatus;

  @ManyToOne(() => User)
  createdBy: User;

  @OneToMany(() => Candidature, (candidature) => candidature.subject, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  candidatures: Candidature[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}