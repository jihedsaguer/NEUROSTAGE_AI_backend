import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SYSTEM_ROLES } from '../roles/constants/roles.constants';
import { Audit } from '../../common/audit/audit.decorator';
import {
  CreateRoomDto,
  AddParticipantDto,
  RoomResponseDto,
  RoomSummaryDto,
  MessageResponseDto,
} from './dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── My rooms ─────────────────────────────────────────────────────────────────

  /**
   * GET /chat/rooms
   * Returns all rooms the current user participates in.
   */
  @Get('rooms')
  getMyRooms(@Request() req: AuthenticatedRequest): Promise<RoomSummaryDto[]> {
    return this.chatService.getMyRooms(req.user);
  }

  // ─── Admin: list all rooms ────────────────────────────────────────────────────

  /**
   * GET /chat/rooms/all
   * Admin-only: returns every room in the system.
   */
  @Get('rooms/all')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  getAllRooms(@Request() req: AuthenticatedRequest): Promise<RoomSummaryDto[]> {
    return this.chatService.getAllRooms(req.user);
  }

  // ─── Admin: create custom room ────────────────────────────────────────────────

  /**
   * POST /chat/rooms
   * Admin-only: create a custom (non-stage) chat room.
   */
  @Post('rooms')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  @Audit('CREATED_CHAT_ROOM', 'ChatRoom')
  createRoom(
    @Body() dto: CreateRoomDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RoomResponseDto> {
    return this.chatService.createCustomRoom(dto, req.user);
  }

  // ─── Room detail ──────────────────────────────────────────────────────────────

  /**
   * GET /chat/rooms/:id
   * Returns room detail including participants.
   * Only accessible to participants of the room.
   */
  @Get('rooms/:id')
  getRoomById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<RoomResponseDto> {
    return this.chatService.getRoomById(id, req.user);
  }

  // ─── Admin: add participant ───────────────────────────────────────────────────

  /**
   * POST /chat/rooms/:id/participants
   * Admin-only: add a user to any room.
   */
  @Post('rooms/:id/participants')
  @Roles(SYSTEM_ROLES.ADMIN_FORMATION, SYSTEM_ROLES.SUPER_ADMIN)
  addParticipant(
    @Param('id') roomId: string,
    @Body() dto: AddParticipantDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<RoomResponseDto> {
    return this.chatService.addParticipant(roomId, dto.userId, req.user);
  }

  // ─── Messages (REST fallback for history) ────────────────────────────────────

  /**
   * GET /chat/rooms/:id/messages
   * Returns paginated message history for a room.
   * Query params:
   *   limit  — number of messages (default 50, max 100)
   *   before — message ID cursor for pagination (load older messages)
   */
  @Get('rooms/:id/messages')
  getMessages(
    @Param('id') roomId: string,
    @Request() req: AuthenticatedRequest,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('before') before?: string,
  ): Promise<MessageResponseDto[]> {
    return this.chatService.getMessages(roomId, req.user, limit ?? 50, before);
  }

  // ─── Delete a message ─────────────────────────────────────────────────────────

  /**
   * DELETE /chat/messages/:id
   * Soft-deletes a message. Sender can delete their own; admins can delete any.
   */
  @Delete('messages/:id')
  @Audit('DELETED_CHAT_MESSAGE', 'ChatMessage')
  async deleteMessage(
    @Param('id') messageId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.chatService.deleteMessage(messageId, req.user);
    return { message: 'Message deleted' };
  }
}
