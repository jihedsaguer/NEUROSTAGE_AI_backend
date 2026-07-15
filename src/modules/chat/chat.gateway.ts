import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { User } from '../users/entities/user.entity';

/**
 * WebSocket gateway for real-time chat.
 *
 * Connection flow:
 *   1. Client connects with JWT: io(url, { auth: { token: 'Bearer <jwt>' } })
 *   2. WsJwtGuard validates token and attaches user to socket.data.user
 *   3. Client emits 'joinRoom' with { roomId } to subscribe to a room
 *   4. Client emits 'sendMessage' with { roomId, content } to send a message
 *   5. Server broadcasts 'newMessage' to all sockets in the room
 *
 * Redis adapter (future):
 *   Replace the default in-memory adapter with @socket.io/redis-adapter
 *   to support horizontal scaling across multiple NestJS instances.
 *   No code changes needed here — only the adapter registration in main.ts.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    // Auth is validated per-message via @UseGuards(WsJwtGuard).
    // We log the connection here but do NOT reject unauthenticated sockets
    // at this stage — rejection happens when the first guarded event fires.
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Join a room ──────────────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const user = this.getUser(client);

    try {
      // Verify the user is a participant before joining the socket room
      await this.chatService.getRoomById(data.roomId, user);
      await client.join(data.roomId);
      this.logger.log(`User ${user.id} joined room ${data.roomId}`);

      client.emit('joinedRoom', { roomId: data.roomId });
    } catch (err) {
      throw new WsException((err as Error).message);
    }
  }

  // ─── Leave a room ─────────────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    await client.leave(data.roomId);
    client.emit('leftRoom', { roomId: data.roomId });
  }

  // ─── Send a message ───────────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ): Promise<void> {
    const user = this.getUser(client);

    try {
      const message = await this.chatService.sendMessage(
        dto.roomId,
        dto.content,
        user,
      );

      // Broadcast to ALL sockets in the room (including sender for confirmation)
      this.server.to(dto.roomId).emit('newMessage', message);
    } catch (err) {
      throw new WsException((err as Error).message);
    }
  }

  // ─── Mark messages as read ────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageId: string },
  ): Promise<void> {
    const user = this.getUser(client);
    await this.chatService.markAsRead(data.roomId, data.messageId, user.id);
  }

  // ─── Typing indicator (no DB persistence) ────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    const user = this.getUser(client);
    // Broadcast to everyone in the room EXCEPT the sender
    client.to(data.roomId).emit('userTyping', {
      userId: user.id,
      firstName: user.firstName,
      roomId: data.roomId,
    });
  }

  // ─── Broadcast helper (called by ChatService or other services) ──────────────

  /**
   * Emit a system event to all sockets in a room.
   * Used by StagesService when encadrantAcad is assigned.
   */
  broadcastToRoom(roomId: string, event: string, payload: unknown): void {
    this.server.to(roomId).emit(event, payload);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private getUser(client: Socket): User {
    const user = client.data?.user as User | undefined;
    if (!user) {
      throw new WsException('Unauthorized');
    }
    return user;
  }
}
