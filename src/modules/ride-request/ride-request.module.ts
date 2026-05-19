import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DriverRegistration } from '../driver-registration/entities/driver-registration.entity';
import { User } from '../user/entities/user.entity';
import { RideRequestController } from './ride-request.controller';
import { DriverRideAlert } from './entities/driver-ride-alert.entity';
import { DriverRideResponse } from './entities/driver-ride-response.entity';
import { RideRequest } from './entities/ride-request.entity';
import { RideRequestService } from './services/ride-request.service';
import { RideRequestGateway } from './ride-request.gateway';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RideRequest,
      DriverRideAlert,
      DriverRideResponse,
      ChatMessage,
      DriverRegistration,
      User,
    ]),
    AuthModule,
  ],
  controllers: [RideRequestController],
  providers: [RideRequestService, RideRequestGateway, ChatService],
})
export class RideRequestModule {}
