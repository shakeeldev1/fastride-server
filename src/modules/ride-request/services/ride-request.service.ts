import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizeAreaText,
  resolveAreaFromLocationText,
} from '../../../common/utils/area-normalizer';
import { EmailService } from '../../auth/services/email.service';
import { DriverRegistration } from '../../driver-registration/entities/driver-registration.entity';
import { User } from '../../user/entities/user.entity';
import { CreateRideRequestDto } from '../dto/create-ride-request.dto';
import { DriverRespondRideRequestDto } from '../dto/driver-respond-ride-request.dto';
import { DriverRideAlert } from '../entities/driver-ride-alert.entity';
import { DriverRideResponse } from '../entities/driver-ride-response.entity';
import { RideRequest } from '../entities/ride-request.entity';

@Injectable()
export class RideRequestService {
  constructor(
    @InjectRepository(RideRequest)
    private readonly rideRequestRepository: Repository<RideRequest>,
    @InjectRepository(DriverRideAlert)
    private readonly driverRideAlertRepository: Repository<DriverRideAlert>,
    @InjectRepository(DriverRideResponse)
    private readonly driverRideResponseRepository: Repository<DriverRideResponse>,
    @InjectRepository(DriverRegistration)
    private readonly driverRegistrationRepository: Repository<DriverRegistration>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  async createRideRequest(riderId: string, dto: CreateRideRequestDto) {
    const rider = await this.userRepository.findOne({ where: { id: riderId } });

    if (!rider || !rider.is_active) {
      throw new BadRequestException('Rider account is not active');
    }

    const targetArea = this.resolveTargetArea(dto.pickupArea, dto.pickupLocation);

    const rideRequest = this.rideRequestRepository.create({
      riderId,
      pickupLocation: dto.pickupLocation,
      pickupArea: targetArea,
      dropoffLocation: dto.dropoffLocation,
      vehicleType: dto.vehicleType,
      offeredPrice: dto.offeredPrice.toFixed(2),
      pickupLatitude:
        dto.pickupLatitude !== undefined ? String(dto.pickupLatitude) : null,
      pickupLongitude:
        dto.pickupLongitude !== undefined ? String(dto.pickupLongitude) : null,
      dropoffLatitude:
        dto.dropoffLatitude !== undefined ? String(dto.dropoffLatitude) : null,
      dropoffLongitude:
        dto.dropoffLongitude !== undefined ? String(dto.dropoffLongitude) : null,
      notes: dto.notes ?? null,
      status: 'open',
      selectedDriverId: null,
      selectedAt: null,
    });

    await this.rideRequestRepository.save(rideRequest);

    const candidateDriverRegs = await this.driverRegistrationRepository.find({
      where: {
        status: 'approved',
        vehicleType: dto.vehicleType,
      },
    });

    const targetDriverRegs = candidateDriverRegs.filter(
      (driverReg) => normalizeAreaText(driverReg.operatingArea) === targetArea,
    );

    const alerts: DriverRideAlert[] = [];

    for (const driverReg of targetDriverRegs) {
      const driver = await this.userRepository.findOne({
        where: {
          id: driverReg.userId,
          is_driver: true,
          is_active: true,
          is_email_verified: true,
        },
      });

      if (!driver) {
        continue;
      }

      const alertMessage = `New ${dto.vehicleType} ride request from ${dto.pickupLocation} to ${dto.dropoffLocation}. Offered price: ${dto.offeredPrice}`;

      const alert = this.driverRideAlertRepository.create({
        rideRequestId: rideRequest.id,
        driverId: driver.id,
        vehicleType: dto.vehicleType,
        pickupArea: targetArea,
        message: alertMessage,
        inAppStatus: 'sent',
        systemStatus: 'queued',
        emailStatus: 'pending',
      });

      await this.driverRideAlertRepository.save(alert);

      try {
        await this.emailService.sendDriverRideAlertEmail(driver.email, driver.name, {
          pickupLocation: dto.pickupLocation,
          dropoffLocation: dto.dropoffLocation,
          vehicleType: dto.vehicleType,
          offeredPrice: dto.offeredPrice,
          rideRequestId: rideRequest.id,
        });

        alert.emailStatus = 'sent';
      } catch (error) {
        alert.emailStatus = 'failed';
        alert.emailError = (error as Error).message;
      }

      await this.driverRideAlertRepository.save(alert);
      alerts.push(alert);
    }

    return {
      message: 'Ride request created and alerts dispatched to matching drivers',
      rideRequest: this.formatRideRequest(rideRequest),
      dispatchedAlerts: alerts.length,
    };
  }

  async getMyRideRequests(riderId: string) {
    const rideRequests = await this.rideRequestRepository.find({
      where: { riderId },
      order: { createdAt: 'DESC' },
    });

    return {
      rideRequests: rideRequests.map((rideRequest) =>
        this.formatRideRequest(rideRequest),
      ),
    };
  }

  async getDriverAlerts(driverId: string) {
    const alerts = await this.driverRideAlertRepository.find({
      where: { driverId },
      order: { createdAt: 'DESC' },
    });

    return { alerts };
  }

  async respondToRideRequest(
    driverId: string,
    rideRequestId: string,
    dto: DriverRespondRideRequestDto,
  ) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.status !== 'open') {
      throw new BadRequestException('Ride request is not open for responses');
    }

    const driver = await this.userRepository.findOne({
      where: { id: driverId, is_driver: true, is_active: true },
    });

    if (!driver) {
      throw new ForbiddenException('Only active drivers can respond to ride requests');
    }

    const alert = await this.driverRideAlertRepository.findOne({
      where: { rideRequestId, driverId },
    });

    if (!alert) {
      throw new ForbiddenException('You are not targeted for this ride request');
    }

    const existingResponse = await this.driverRideResponseRepository.findOne({
      where: { rideRequestId, driverId },
    });

    const response = existingResponse
      ? existingResponse
      : this.driverRideResponseRepository.create({ rideRequestId, driverId, decision: dto.decision });

    response.decision = dto.decision;
    response.counterOfferPrice =
      dto.counterOfferPrice !== undefined ? dto.counterOfferPrice.toFixed(2) : null;
    response.message = dto.message ?? null;

    await this.driverRideResponseRepository.save(response);

    alert.isRead = true;
    alert.inAppStatus = 'opened';
    await this.driverRideAlertRepository.save(alert);

    return {
      message: 'Ride response submitted successfully',
      response: {
        id: response.id,
        rideRequestId: response.rideRequestId,
        driverId: response.driverId,
        decision: response.decision,
        counterOfferPrice:
          response.counterOfferPrice !== null
            ? Number(response.counterOfferPrice)
            : null,
        message: response.message,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      },
    };
  }

  async getRideResponsesForRider(riderId: string, rideRequestId: string) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.riderId !== riderId) {
      throw new ForbiddenException('You can only view responses for your own ride requests');
    }

    const responses = await this.driverRideResponseRepository.find({
      where: { rideRequestId },
      order: { createdAt: 'ASC' },
    });

    return {
      rideRequestId,
      status: rideRequest.status,
      selectedDriverId: rideRequest.selectedDriverId,
      responses: responses.map((response) => ({
        id: response.id,
        driverId: response.driverId,
        decision: response.decision,
        counterOfferPrice:
          response.counterOfferPrice !== null
            ? Number(response.counterOfferPrice)
            : null,
        message: response.message,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      })),
    };
  }

  async selectDriverForRideRequest(
    riderId: string,
    rideRequestId: string,
    driverId: string,
  ) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.riderId !== riderId) {
      throw new ForbiddenException('You can only select driver for your own ride request');
    }

    if (rideRequest.status !== 'open') {
      throw new BadRequestException('Driver can only be selected when ride request is open');
    }

    const chosenResponse = await this.driverRideResponseRepository.findOne({
      where: { rideRequestId, driverId, decision: 'interested' },
    });

    if (!chosenResponse) {
      throw new BadRequestException('Selected driver has not shown interest for this ride');
    }

    rideRequest.status = 'driver_selected';
    rideRequest.selectedDriverId = driverId;
    rideRequest.selectedAt = new Date();
    await this.rideRequestRepository.save(rideRequest);

    return {
      message: 'Driver selected successfully',
      rideRequest: this.formatRideRequest(rideRequest),
      selectedResponse: {
        id: chosenResponse.id,
        driverId: chosenResponse.driverId,
        decision: chosenResponse.decision,
        counterOfferPrice:
          chosenResponse.counterOfferPrice !== null
            ? Number(chosenResponse.counterOfferPrice)
            : null,
        message: chosenResponse.message,
      },
    };
  }

  async markDriverAlertRead(driverId: string, alertId: string, isRead: boolean) {
    const alert = await this.driverRideAlertRepository.findOne({
      where: { id: alertId, driverId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.isRead = isRead;
    await this.driverRideAlertRepository.save(alert);

    return {
      message: 'Alert updated successfully',
      alert,
    };
  }

  private formatRideRequest(rideRequest: RideRequest) {
    return {
      id: rideRequest.id,
      riderId: rideRequest.riderId,
      pickupLocation: rideRequest.pickupLocation,
      pickupArea: rideRequest.pickupArea,
      dropoffLocation: rideRequest.dropoffLocation,
      vehicleType: rideRequest.vehicleType,
      offeredPrice: Number(rideRequest.offeredPrice),
      pickupLatitude:
        rideRequest.pickupLatitude !== null
          ? Number(rideRequest.pickupLatitude)
          : null,
      pickupLongitude:
        rideRequest.pickupLongitude !== null
          ? Number(rideRequest.pickupLongitude)
          : null,
      dropoffLatitude:
        rideRequest.dropoffLatitude !== null
          ? Number(rideRequest.dropoffLatitude)
          : null,
      dropoffLongitude:
        rideRequest.dropoffLongitude !== null
          ? Number(rideRequest.dropoffLongitude)
          : null,
      notes: rideRequest.notes,
      status: rideRequest.status,
      selectedDriverId: rideRequest.selectedDriverId,
      selectedAt: rideRequest.selectedAt,
      createdAt: rideRequest.createdAt,
      updatedAt: rideRequest.updatedAt,
    };
  }

  private resolveTargetArea(
    pickupArea: string | undefined,
    pickupLocation: string,
  ): string {
    if (pickupArea && pickupArea.trim().length >= 2) {
      return normalizeAreaText(pickupArea);
    }

    const derivedArea = resolveAreaFromLocationText(pickupLocation);

    if (derivedArea.length > 0) {
      return derivedArea;
    }

    throw new BadRequestException('Unable to determine pickup area from pickup location');
  }
}
