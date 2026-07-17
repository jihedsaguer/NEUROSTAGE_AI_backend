import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Stage } from '../../stages/entities/stage.entity';


export enum CandidatureStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    SHORTLISTED = 'shortlisted',
    REJECTED = 'rejected',
}

@Entity()
@Unique(['student', 'subject'])
export class Candidature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
    student: User;

    @ManyToOne(() => Subject, (subject) => subject.candidatures, { eager: true })
    subject: Subject;

    @Column({
        type: 'enum',
        enum: CandidatureStatus,
        default: CandidatureStatus.PENDING,
    })
    status: CandidatureStatus;

    @Column({ nullable: true })
    motivation: string;

    @OneToMany(() => Stage, (stage) => stage.candidature, {
      cascade: true,
      onDelete: 'CASCADE',
    })
    stages: Stage[];

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'float', nullable: true })
    scoreMatch: number;

    @Column({ type: 'text', nullable: true, default: null })
    matchDetails: string | null;

    @UpdateDateColumn()
    updatedAt: Date;
}