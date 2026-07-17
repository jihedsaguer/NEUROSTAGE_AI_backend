import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../users/entities/user.entity';

@Entity('chat_participants')
@Index(['roomId', 'userId'], { unique: true })
export class ChatParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (room) => room.participants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  /** Tracks the last message the user has read — used for unread count */
  @Column({ type: 'varchar', nullable: true })
  lastReadMessageId: string | null;

  @CreateDateColumn()
  joinedAt: Date;
}
