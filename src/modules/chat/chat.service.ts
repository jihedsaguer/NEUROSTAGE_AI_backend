import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom, ChatRoomType } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { ChatMessage, MessageType } from './entities/chat-message.entity';
import { Stage } from '../stages/entities/stage.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../../common/audit/audit.service';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import {
  CreateRoomDto,
  RoomResponseDto,
  RoomSummaryDto,
  MessageResponseDto,
  ParticipantSummaryDto,
} from './dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatRoom)
    private readonly roomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatParticipant)
    private readonly participantRepository: Repository<ChatParticipant>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  // ─── Auto-create room when a Stage is created ────────────────────────────────

  /**
   * Called by StagesService after a stage is persisted.
   * Creates a STAGE-type room and adds student + encadrantPro as mandatory
   * participants. encadrantAcad is added if already assigned.
   * Idempotent — safe to call multiple times for the same stage.
   */
  async createRoomForStage(stage: Stage): Promise<ChatRoom> {
    // Guard: don't create duplicate rooms
    const existing = await this.roomRepository.findOne({
      where: { stageId: stage.id },
    });
    if (existing) {
      this.logger.warn(`Chat room already exists for stage ${stage.id}`);
      return existing;
    }

    // Load stage with all participant relations if not already loaded
    const fullStage = await this.stageRepository.findOne({
      where: { id: stage.id },
      relations: ['student', 'encadrantPro', 'encadrantAcad', 'subject'],
    });
    if (!fullStage) throw new NotFoundException(`Stage ${stage.id} not found`);

    const roomName = `Stage — ${fullStage.subject?.title ?? fullStage.id}`;

    const room = this.roomRepository.create({
      name: roomName,
      description: `Chat room for internship stage`,
      type: ChatRoomType.STAGE,
      stageId: fullStage.id,
      isActive: true,
    });

    const savedRoom = await this.roomRepository.save(room);

    // Add mandatory participants
    const participantUserIds: string[] = [
      fullStage.studentId,
      fullStage.encadrantProId,
    ];

    // Add academic supervisor if already assigned
    if (fullStage.encadrantAcadId) {
      participantUserIds.push(fullStage.encadrantAcadId);
    }

    await this.addParticipantsBulk(savedRoom.id, participantUserIds);

    // Post a SYSTEM message to mark room creation
    await this.postSystemMessage(
      savedRoom.id,
      `Chat room created for stage "${roomName}".`,
    );

    this.logger.log(`Chat room ${savedRoom.id} created for stage ${fullStage.id}`);
    return savedRoom;
  }

  /**
   * Called when encadrantAcad is assigned to a stage after initial creation.
   * Adds them to the existing stage chat room.
   */
  async addEncadrantAcadToStageRoom(stageId: string, userId: string): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { stageId } });
    if (!room) return; // room may not exist yet if stage was just created

    const alreadyIn = await this.participantRepository.findOne({
      where: { roomId: room.id, userId },
    });
    if (alreadyIn) return;

    await this.addParticipantsBulk(room.id, [userId]);
    await this.postSystemMessage(room.id, `Academic supervisor joined the chat.`);
  }

  // ─── Admin: create custom room ───────────────────────────────────────────────

  async createCustomRoom(dto: CreateRoomDto, admin: User): Promise<RoomResponseDto> {
    const room = this.roomRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      type: ChatRoomType.CUSTOM,
      stageId: null,
      isActive: true,
    });

    const saved = await this.roomRepository.save(room);

    // Admin who created the room is automatically a participant
    await this.addParticipantsBulk(saved.id, [admin.id]);

    await this.auditService.log('CREATED_CHAT_ROOM', admin.id, 'ChatRoom', saved.id);

    return this.loadRoomResponse(saved.id);
  }

  // ─── Admin: add participant to any room ──────────────────────────────────────

  async addParticipant(roomId: string, userId: string, requestingUser: User): Promise<RoomResponseDto> {
    this.assertAdmin(requestingUser);

    const room = await this.findRoomOrFail(roomId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const existing = await this.participantRepository.findOne({
      where: { roomId, userId },
    });
    if (existing) throw new ConflictException('User is already a participant');

    await this.addParticipantsBulk(roomId, [userId]);
    await this.postSystemMessage(roomId, `${user.firstName} ${user.lastName} was added to the chat.`);

    return this.loadRoomResponse(roomId);
  }

  // ─── Get rooms for current user ──────────────────────────────────────────────

  async getMyRooms(user: User): Promise<RoomSummaryDto[]> {
    const participations = await this.participantRepository.find({
      where: { userId: user.id },
      relations: ['room'],
    });

    const roomIds = participations.map((p) => p.roomId);
    if (roomIds.length === 0) return [];

    const rooms = await this.roomRepository
      .createQueryBuilder('room')
      .leftJoin('room.participants', 'participant')
      .where('room.id IN (:...roomIds)', { roomIds })
      .andWhere('room.isActive = true')
      .select([
        'room.id',
        'room.name',
        'room.type',
        'room.stageId',
        'room.isActive',
        'room.createdAt',
      ])
      .addSelect('COUNT(participant.id)', 'participantCount')
      .groupBy('room.id')
      .orderBy('room.createdAt', 'DESC')
      .getRawAndEntities();

    return rooms.entities.map((room, i) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      stageId: room.stageId,
      isActive: room.isActive,
      participantCount: parseInt(rooms.raw[i]?.participantCount ?? '0', 10),
      createdAt: room.createdAt,
    }));
  }

  // ─── Get room detail (participants must check access) ────────────────────────

  async getRoomById(roomId: string, user: User): Promise<RoomResponseDto> {
    await this.assertParticipant(roomId, user.id);
    return this.loadRoomResponse(roomId);
  }

  // ─── Get messages (paginated) ────────────────────────────────────────────────

  async getMessages(
    roomId: string,
    user: User,
    limit = 50,
    before?: string,
  ): Promise<MessageResponseDto[]> {
    await this.assertParticipant(roomId, user.id);

    let query = this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .where('msg.roomId = :roomId', { roomId })
      .orderBy('msg.createdAt', 'DESC')
      .take(Math.min(limit, 100));

    // Cursor-based pagination: load messages older than the given message ID
    if (before) {
      const pivot = await this.messageRepository.findOne({ where: { id: before } });
      if (pivot) {
        query = query.andWhere('msg.createdAt < :pivotDate', {
          pivotDate: pivot.createdAt,
        });
      }
    }

    const messages = await query.getMany();

    // Return in chronological order (oldest first)
    return messages.reverse().map((m) => this.mapMessage(m));
  }

  // ─── Send a message (called from gateway) ────────────────────────────────────

  async sendMessage(
    roomId: string,
    content: string,
    sender: User,
  ): Promise<MessageResponseDto> {
    await this.assertParticipant(roomId, sender.id);

    const room = await this.findRoomOrFail(roomId);
    if (!room.isActive) {
      throw new BadRequestException('This chat room is no longer active');
    }

    const message = this.messageRepository.create({
      roomId,
      senderId: sender.id,
      content: content.trim(),
      type: MessageType.TEXT,
      isDeleted: false,
    });

    const saved = await this.messageRepository.save(message);

    // Audit every message send — non-blocking
    this.auditService
      .log('SENT_CHAT_MESSAGE', sender.id, 'ChatMessage', saved.id)
      .catch((err) =>
        this.logger.error('Audit log failed for message', err),
      );

    // Reload with sender relation for the response
    const full = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    return this.mapMessage(full!);
  }

  // ─── Soft-delete a message (sender or admin) ─────────────────────────────────

  async deleteMessage(messageId: string, user: User): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    const isAdmin = this.isAdmin(user);
    const isSender = message.senderId === user.id;

    if (!isAdmin && !isSender) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    message.isDeleted = true;
    message.content = '[deleted]';
    await this.messageRepository.save(message);
  }

  // ─── Mark messages as read ───────────────────────────────────────────────────

  async markAsRead(roomId: string, messageId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId },
    });
    if (!participant) return;

    participant.lastReadMessageId = messageId;
    await this.participantRepository.save(participant);
  }

  // ─── Admin: get all rooms ────────────────────────────────────────────────────

  async getAllRooms(user: User): Promise<RoomSummaryDto[]> {
    this.assertAdmin(user);

    const rooms = await this.roomRepository.find({
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      stageId: room.stageId,
      isActive: room.isActive,
      participantCount: 0, // populated separately if needed
      createdAt: room.createdAt,
    }));
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async addParticipantsBulk(roomId: string, userIds: string[]): Promise<void> {
    const participants = userIds.map((userId) =>
      this.participantRepository.create({ roomId, userId, lastReadMessageId: null }),
    );
    await this.participantRepository.save(participants);
  }

  private async postSystemMessage(roomId: string, content: string): Promise<void> {
    const msg = this.messageRepository.create({
      roomId,
      senderId: null,
      content,
      type: MessageType.SYSTEM,
      isDeleted: false,
    });
    await this.messageRepository.save(msg);
  }

  private async assertParticipant(roomId: string, userId: string): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { roomId, userId },
    });
    if (!participant) {
      throw new ForbiddenException('You are not a participant of this chat room');
    }
  }

  private async findRoomOrFail(roomId: string): Promise<ChatRoom> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException(`Chat room ${roomId} not found`);
    return room;
  }

  private assertAdmin(user: User): void {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only admins can perform this action');
    }
  }

  private isAdmin(user: User): boolean {
    return (user.roles ?? []).some(
      (r) =>
        r.name === SYSTEM_ROLES.ADMIN_FORMATION ||
        r.name === SYSTEM_ROLES.SUPER_ADMIN,
    );
  }

  private async loadRoomResponse(roomId: string): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['participants', 'participants.user'],
    });
    if (!room) throw new NotFoundException(`Chat room ${roomId} not found`);

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      stageId: room.stageId,
      isActive: room.isActive,
      participants: room.participants.map((p) => this.mapParticipant(p)),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private mapParticipant(p: ChatParticipant): ParticipantSummaryDto {
    return {
      id: p.id,
      userId: p.userId,
      firstName: p.user?.firstName ?? '',
      lastName: p.user?.lastName ?? '',
      email: p.user?.email ?? '',
      joinedAt: p.joinedAt,
    };
  }

  private mapMessage(m: ChatMessage): MessageResponseDto {
    return {
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      senderFirstName: m.sender?.firstName ?? null,
      senderLastName: m.sender?.lastName ?? null,
      content: m.content,
      type: m.type,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt,
    };
  }
}
