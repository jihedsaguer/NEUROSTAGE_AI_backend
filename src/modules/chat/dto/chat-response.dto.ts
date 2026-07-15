import { ChatRoomType } from '../entities/chat-room.entity';
import { MessageType } from '../entities/chat-message.entity';

export class ParticipantSummaryDto {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: Date;
}

export class MessageResponseDto {
  id: string;
  roomId: string;
  senderId: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  content: string;
  type: MessageType;
  isDeleted: boolean;
  createdAt: Date;
}

export class RoomResponseDto {
  id: string;
  name: string;
  description: string | null;
  type: ChatRoomType;
  stageId: string | null;
  isActive: boolean;
  participants: ParticipantSummaryDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class RoomSummaryDto {
  id: string;
  name: string;
  type: ChatRoomType;
  stageId: string | null;
  isActive: boolean;
  participantCount: number;
  createdAt: Date;
}
