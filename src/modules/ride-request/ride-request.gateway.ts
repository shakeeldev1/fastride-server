import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RideRequest } from './entities/ride-request.entity';
import { User } from '../user/entities/user.entity';
import { ChatService } from './services/chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class RideRequestGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RideRequestGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(RideRequest)
    private readonly rideRequestRepository: Repository<RideRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        this.logger.warn('Socket connection rejected: missing token');
        client.disconnect();
        return;
      }

      const payload: any = this.jwtService.verify(String(token));
      if (!payload || !payload.id) {
        this.logger.warn('Socket connection rejected: invalid token');
        client.disconnect();
        return;
      }

      // fetch user to ensure still active
      const user = await this.userRepository.findOne({ where: { id: payload.id } });
      if (!user || !user.is_active) {
        this.logger.warn(`Socket connection rejected: user ${payload.id} not found or inactive`);
        client.disconnect();
        return;
      }

      client.data.user = { id: user.id, is_driver: user.is_driver };
      this.logger.log(`Socket connected: user=${user.id}`);
    } catch (err) {
      this.logger.warn('Socket authentication failed', (err as Error).message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const uid = client.data?.user?.id ?? 'unknown';
    this.logger.log(`Socket disconnected: user=${uid}`);
  }

  // Notify drivers in an area+vehicle room about a new ride request
  notifyDrivers(area: string, vehicleFamily: string, payload: any) {
    const room = `area:${area}:${vehicleFamily}`;
    this.logger.log(`Emitting ride_request:created to room ${room}`);
    this.server.to(room).emit('ride_request:created', payload);
  }

  // Notify a specific rider (by userId) about a new driver response
  notifyRiderResponse(riderId: string, payload: any) {
    const room = `rider:${riderId}`;
    this.logger.log(`Emitting ride_request:response to ${room}`);
    this.server.to(room).emit('ride_request:response', payload);
  }

  // Notify rider and driver when a driver is selected
  notifyDriverSelected(riderId: string, driverId: string, payload: any) {
    const riderRoom = `rider:${riderId}`;
    const driverRoom = `driver:${driverId}`;
    this.logger.log(`Emitting ride_request:driver_selected to ${riderRoom} and ${driverRoom}`);
    this.server.to(riderRoom).emit('ride_request:driver_selected', payload);
    this.server.to(driverRoom).emit('ride_request:driver_assigned', payload);
  }

  // Add connected rider/driver sockets to chat room so they receive chat messages immediately
  async joinUsersToChatRoom(rideRequestId: string, riderId: string, driverId: string) {
    const room = `chat:ride:${rideRequestId}`;

    const sockets = Array.from(this.server.sockets.sockets.values());

    for (const sock of sockets) {
      const uid = sock.data?.user?.id;
      if (!uid) continue;
      if (uid === riderId || uid === driverId) {
        sock.join(room);
        this.logger.log(`Socket user=${uid} joined chat room ${room}`);
      }
    }

    // Notify both parties the chat room is ready
    this.server.to(`rider:${riderId}`).emit('chat:room_ready', { rideRequestId, room });
    this.server.to(`driver:${driverId}`).emit('chat:room_ready', { rideRequestId, room });
  }

  @SubscribeMessage('join')
  async handleJoin(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    const room = data?.room;
    const user = client.data?.user;
    if (!room || !user) return;

    // Authorization rules
    if (room.startsWith('rider:')) {
      const riderId = room.split(':')[1];
      if (riderId !== user.id) return; // riders can only join their own rider room
    }

    if (room.startsWith('driver:')) {
      const driverId = room.split(':')[1];
      if (driverId !== user.id || !user.is_driver) return; // only the driver
    }

    if (room.startsWith('area:')) {
      // driver-only room
      if (!user.is_driver) return;
    }

    client.join(room);
    this.logger.log(`Socket user=${user.id} joined room ${room}`);
  }

  @SubscribeMessage('leave')
  async handleLeave(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    const room = data?.room;
    const user = client.data?.user;
    if (!room || !user) return;
    client.leave(room);
    this.logger.log(`Socket user=${user.id} left room ${room}`);
  }

  @SubscribeMessage('chat:message')
  async handleChatMessage(@MessageBody() data: { rideRequestId: string; text: string }, @ConnectedSocket() client: Socket) {
    const user = client.data?.user;
    if (!user) return;
    const { rideRequestId, text } = data;
    if (!rideRequestId || !text) return;

    const ride = await this.rideRequestRepository.findOne({ where: { id: rideRequestId } });
    if (!ride) return;

    // allow only rider or selected driver to chat (only after driver is selected)
    if (ride.status !== 'driver_selected') return;
    const allowed = user.id === ride.riderId || user.id === ride.selectedDriverId;
    if (!allowed) return;

    const room = `chat:ride:${rideRequestId}`;
    // persist message
    try {
      const saved = await this.chatService.saveMessage(rideRequestId, user.id, text);
      const payload = {
        rideRequestId,
        from: user.id,
        text: saved.text,
        sentAt: saved.sentAt.toISOString(),
        id: saved.id,
      };

      this.server.to(room).emit('chat:message', payload);
      this.logger.log(`Chat message emitted to ${room} from ${user.id}`);
    } catch (err) {
      this.logger.warn('Failed to save chat message', (err as Error).message);
    }
  }
}
