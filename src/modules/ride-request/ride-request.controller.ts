import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { DriverRespondRideRequestDto } from './dto/driver-respond-ride-request.dto';
import { MarkAlertReadDto } from './dto/mark-alert-read.dto';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { RideRequestService } from './services/ride-request.service';

@Controller('api/ride-requests')
export class RideRequestController {
  constructor(private readonly rideRequestService: RideRequestService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async createRideRequest(
    @Request() req: any,
    @Body() dto: CreateRideRequestDto,
  ) {
    return this.rideRequestService.createRideRequest(req.user.id, dto);
  }

  @Post('estimate')
  @HttpCode(200)
  async estimateFare(@Body() dto: EstimateFareDto) {
    return this.rideRequestService.estimateFare(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getMyRideRequests(@Request() req: any) {
    return this.rideRequestService.getMyRideRequests(req.user.id);
  }

  @Get('driver/alerts')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getDriverAlerts(@Request() req: any) {
    return this.rideRequestService.getDriverAlerts(req.user.id);
  }

  @Post(':rideRequestId/driver/respond')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async respondToRideRequest(
    @Request() req: any,
    @Param('rideRequestId') rideRequestId: string,
    @Body() dto: DriverRespondRideRequestDto,
  ) {
    return this.rideRequestService.respondToRideRequest(
      req.user.id,
      rideRequestId,
      dto,
    );
  }

  @Get(':rideRequestId/responses')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getRideResponsesForRider(
    @Request() req: any,
    @Param('rideRequestId') rideRequestId: string,
  ) {
    return this.rideRequestService.getRideResponsesForRider(
      req.user.id,
      rideRequestId,
    );
  }

  @Get(':rideRequestId/chat')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getChatMessages(
    @Request() req: any,
    @Param('rideRequestId') rideRequestId: string,
  ) {
    return this.rideRequestService.getChatMessages(req.user.id, rideRequestId);
  }

  @Post(':rideRequestId/select-driver/:driverId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async selectDriverForRideRequest(
    @Request() req: any,
    @Param('rideRequestId') rideRequestId: string,
    @Param('driverId') driverId: string,
  ) {
    return this.rideRequestService.selectDriverForRideRequest(
      req.user.id,
      rideRequestId,
      driverId,
    );
  }

  @Patch('driver/alerts/:alertId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async markDriverAlertRead(
    @Request() req: any,
    @Param('alertId') alertId: string,
    @Body() dto: MarkAlertReadDto,
  ) {
    return this.rideRequestService.markDriverAlertRead(
      req.user.id,
      alertId,
      dto.isRead,
    );
  }
}
