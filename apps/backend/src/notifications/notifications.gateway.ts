import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },  // tighten in production
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Client emits this after connecting, to join their personal room
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${data.userId}`);
    this.logger.log(`Socket ${client.id} joined room user:${data.userId}`);
  }

  // ── Send to one user ───────────────────────────────────────────
  notifyUser(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  // ── Send to multiple users ────────────────────────────────────
  notifyUsers(userIds: string[], payload: any) {
    userIds.forEach((id) => this.notifyUser(id, payload));
  }

  // ── Broadcast to everyone connected ───────────────────────────
  notifyAll(payload: any) {
    return this.server.emit('notification:new', payload);
  }
}