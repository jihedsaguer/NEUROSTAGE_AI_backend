import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Stage } from '../../stages/entities/stage.entity';
import { ChatParticipant } from './chat-participant.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatRoomType {
  /** Auto-created when a Stage is created — tied to a specific stage */
  STAGE = 'STAGE',
  /** Manually created by an admin (Slack-like custom rooms) */
  CUSTOM = 'CUSTOM',
}

@Entity('chat_rooms')
@Index(['stageId'], { unique: true, where: '"stage_id" IS NOT NULL' })
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ChatRoomType,
    default: ChatRoomType.STAGE,
  })
  type: ChatRoomType;

  /** Nullable — only set for STAGE rooms */
  @OneToOne(() => Stage, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage | null;

  @Column({ name: 'stage_id', nullable: true })
  stageId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ChatParticipant, (p) => p.room, { cascade: true })
  participants: ChatParticipant[];

  @OneToMany(() => ChatMessage, (m) => m.room, { cascade: true })
  messages: ChatMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
