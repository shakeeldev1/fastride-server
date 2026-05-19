import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class RideRequestGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RideRequestGateway.name);

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
}
