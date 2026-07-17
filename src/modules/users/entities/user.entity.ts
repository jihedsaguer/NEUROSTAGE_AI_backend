import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  OneToOne,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Exclude } from 'class-transformer';
import { StudentProfile } from '../../profiles/entities/profiles.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  @Exclude()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false, nullable: true })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationTokenExpires: Date | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  refreshToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpires: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  // FK lives on student_profiles.user_id — do NOT add @JoinColumn here.
  // eager: false to avoid loading the full profile on every JWT validation.
  @OneToOne(() => StudentProfile, (profile) => profile.user, {
    cascade: true,
    eager: false,
  })
  profile: StudentProfile;
}