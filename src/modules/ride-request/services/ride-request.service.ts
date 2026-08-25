import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  normalizeAreaText,
  resolveAreaFromLocationText,
  isGenericLocationString,
} from '../../../common/utils/area-normalizer';
import {
  calculateDistanceKm,
  calculateRideFare,
  RideServiceArea,
  RideVehicleType,
} from '../../../common/utils/fare-calculator';
import { EmailService } from '../../auth/services/email.service';
import { DriverRegistration } from '../../driver-registration/entities/driver-registration.entity';
import { User } from '../../user/entities/user.entity';
import { WalletService } from '../../wallet/services/wallet.service';
import { CreateRideRequestDto } from '../dto/create-ride-request.dto';
import { DriverRespondRideRequestDto } from '../dto/driver-respond-ride-request.dto';
import { DriverRideAlert } from '../entities/driver-ride-alert.entity';
import { DriverRideResponse } from '../entities/driver-ride-response.entity';
import { RideRequest } from '../entities/ride-request.entity';
import { RideRequestGateway } from '../ride-request.gateway';
import { ChatService } from './chat.service';
import { DriverLocationService } from './driver-location.service';

// Ride requests only go to drivers currently within this radius of pickup.
const RIDE_MATCH_RADIUS_KM = 5;

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
    private readonly gateway: RideRequestGateway,
    private readonly chatService: ChatService,
    private readonly walletService: WalletService,
    private readonly driverLocationService: DriverLocationService,
  ) {}

  async createRideRequest(riderId: string, dto: CreateRideRequestDto) {
    const rider = await this.userRepository.findOne({ where: { id: riderId } });

    if (!rider || !rider.is_active) {
      throw new BadRequestException('Rider account is not active');
    }

    const targetArea = this.resolveTargetArea(dto.pickupArea, dto.pickupLocation, dto.dropoffLocation);
    const serviceArea: RideServiceArea = dto.serviceArea === 'out_of_city' ? 'out_of_city' : 'city';
    const vehicleType = dto.vehicleType as RideVehicleType;
    const estimatedDistanceKm = this.resolveEstimatedDistanceKm(dto);

    let fareBreakdown;

    try {
      fareBreakdown = calculateRideFare({
        vehicleType,
        serviceArea,
        estimatedDistanceKm,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Sorry service not available') {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const offeredPriceValue = dto.offeredPrice !== undefined ? Number(dto.offeredPrice) : Number(fareBreakdown.totalFare);

    const rideRequest = this.rideRequestRepository.create({
      riderId,
      pickupLocation: dto.pickupLocation,
      pickupArea: targetArea,
      dropoffLocation: dto.dropoffLocation,
      vehicleType: dto.vehicleType,
      serviceArea,
      offeredPrice: offeredPriceValue.toFixed(2),
      estimatedDistanceKm: fareBreakdown.estimatedDistanceKm.toFixed(2),
      companyCommission: fareBreakdown.companyCommission.toFixed(2),
      driverPayout: fareBreakdown.driverPayout.toFixed(2),
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
      paymentMethod: dto.paymentMethod,
    });

    await this.rideRequestRepository.save(rideRequest);

    const candidateDriverRegs = await this.driverRegistrationRepository.find({
      where: {
        status: 'approved',
        vehicleType: this.resolveDriverVehicleFamily(dto.vehicleType),
      },
    });

    console.log(
      `[Ride Alert] Searching drivers: vehicleFamily=${this.resolveDriverVehicleFamily(dto.vehicleType)}, riderGender=${rider.gender ?? 'unset'}, totalCandidates=${candidateDriverRegs.length}`,
    );

    const pickupLatitude = Number(rideRequest.pickupLatitude);
    const pickupLongitude = Number(rideRequest.pickupLongitude);

    const matchedDrivers: { driver: User; distanceKm: number | null }[] = [];

    for (const driverReg of candidateDriverRegs) {
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

      // Gender match is only enforced once the rider has a gender on file —
      // legacy rider accounts without one keep the old unrestricted behavior.
      if (rider.gender && driver.gender !== rider.gender) {
        continue;
      }

      const liveLocation = this.driverLocationService.getFresh(driver.id);
      let distanceKm: number | null = null;

      if (liveLocation) {
        distanceKm = calculateDistanceKm({
          pickupLatitude,
          pickupLongitude,
          dropoffLatitude: liveLocation.lat,
          dropoffLongitude: liveLocation.lng,
        });

        if (distanceKm > RIDE_MATCH_RADIUS_KM) {
          continue;
        }
      } else {
        // Driver hasn't reported a live GPS position yet (e.g. an older app
        // build) — fall back to the legacy operating-area text match so
        // dispatch doesn't go dark for them during rollout.
        const driverNormalizedArea = normalizeAreaText(driverReg.operatingArea);
        if (!this.areasMatch(driverNormalizedArea, targetArea)) {
          continue;
        }
      }

      matchedDrivers.push({ driver, distanceKm });
    }

    console.log(
      `[Ride Alert] Matched ${matchedDrivers.length} driver(s) after gender + proximity filtering`,
    );

    const alerts: DriverRideAlert[] = [];
    const notifiedDriverIds: string[] = [];

    for (const { driver, distanceKm } of matchedDrivers) {
      const distanceSuffix = distanceKm !== null ? ` (${distanceKm.toFixed(1)} km away)` : '';
      const alertMessage = `New ${dto.vehicleType} ride request from ${dto.pickupLocation} to ${dto.dropoffLocation}${distanceSuffix}. Offered price: ${fareBreakdown.totalFare}`;

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
          offeredPrice: fareBreakdown.totalFare,
          rideRequestId: rideRequest.id,
        });

        alert.emailStatus = 'sent';
      } catch (error) {
        alert.emailStatus = 'failed';
        alert.emailError = (error as Error).message;
      }

      await this.driverRideAlertRepository.save(alert);
      alerts.push(alert);
      notifiedDriverIds.push(driver.id);
    }

    // Emit a real-time event directly to each matched driver's own room
    try {
      this.gateway.notifyDrivers(notifiedDriverIds, {
        rideRequestId: rideRequest.id,
        pickupLocation: dto.pickupLocation,
        dropoffLocation: dto.dropoffLocation,
        vehicleType: dto.vehicleType,
        offeredPrice: offeredPriceValue,
        estimatedDistanceKm: fareBreakdown.estimatedDistanceKm,
      });
    } catch (err) {
      // don't break the main flow on realtime failure
      console.warn('Realtime notify failed:', err);
    }

    return {
      message: 'Ride request created and alerts dispatched to matching drivers',
      rideRequest: this.formatRideRequest(rideRequest),
      dispatchedAlerts: alerts.length,
      fareBreakdown,
    };
  }

  async getMyRideRequests(riderId: string) {
    const rideRequests = await this.rideRequestRepository.find({
      where: { riderId },
      order: { createdAt: 'DESC' },
    });

    const driverIds = Array.from(
      new Set(
        rideRequests
          .filter((ride) => ride.paymentMethod === 'online' && ride.selectedDriverId)
          .map((ride) => ride.selectedDriverId as string),
      ),
    );

    const driverById = new Map<string, User>();

    if (driverIds.length > 0) {
      const drivers = await this.userRepository.find({ where: { id: In(driverIds) } });
      drivers.forEach((driver) => driverById.set(driver.id, driver));
    }

    return {
      rideRequests: rideRequests.map((rideRequest) =>
        this.formatRideRequest(
          rideRequest,
          rideRequest.selectedDriverId ? driverById.get(rideRequest.selectedDriverId) : undefined,
        ),
      ),
    };
  }

  async getDriverAlerts(driverId: string) {
    const alerts = await this.driverRideAlertRepository.find({
      where: { driverId },
      order: { createdAt: 'DESC' },
    });

    if (alerts.length === 0) {
      return { alerts: [] };
    }

    const rideRequestIds = Array.from(new Set(alerts.map((alert) => alert.rideRequestId)));
    const rideRequests = await this.rideRequestRepository.find({
      where: { id: In(rideRequestIds) },
    });

    const rideById = new Map(rideRequests.map((ride) => [ride.id, ride]));

    const enrichedAlerts = alerts.map((alert) => {
      const ride = rideById.get(alert.rideRequestId);

      return {
        ...alert,
        ride: ride
          ? {
              pickupLocation: ride.pickupLocation,
              dropoffLocation: ride.dropoffLocation,
              pickupArea: ride.pickupArea,
              vehicleType: ride.vehicleType,
              serviceArea: ride.serviceArea,
              offeredPrice: Number(ride.offeredPrice),
              estimatedDistanceKm: Number(ride.estimatedDistanceKm),
              companyCommission: Number(ride.companyCommission),
              driverPayout: Number(ride.driverPayout),
              pickupLatitude: ride.pickupLatitude !== null ? Number(ride.pickupLatitude) : null,
              pickupLongitude: ride.pickupLongitude !== null ? Number(ride.pickupLongitude) : null,
              dropoffLatitude: ride.dropoffLatitude !== null ? Number(ride.dropoffLatitude) : null,
              dropoffLongitude: ride.dropoffLongitude !== null ? Number(ride.dropoffLongitude) : null,
              paymentMethod: ride.paymentMethod,
              status: ride.status,
              createdAt: ride.createdAt,
            }
          : null,
      };
    });

    return { alerts: enrichedAlerts };
  }

  async estimateFare(dto: { pickupLatitude: number; pickupLongitude: number; dropoffLatitude: number; dropoffLongitude: number; serviceArea?: string; }) {
    const estimatedDistanceKm = calculateDistanceKm({
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      dropoffLatitude: dto.dropoffLatitude,
      dropoffLongitude: dto.dropoffLongitude,
    });

    const serviceArea: RideServiceArea = dto.serviceArea === 'out_of_city' ? 'out_of_city' : 'city';

    const vehicleTypes: RideVehicleType[] = [
      'bike',
      'rikshaw',
      'car_without_ac',
      'car_with_ac',
      'business_car',
    ];

    const results: Record<string, any> = {};

    for (const vt of vehicleTypes) {
      try {
        const breakdown = calculateRideFare({
          vehicleType: vt,
          serviceArea,
          estimatedDistanceKm,
        });

        results[vt] = breakdown;
      } catch (err) {
        results[vt] = { error: (err as Error).message };
      }
    }

    return {
      estimatedDistanceKm,
      serviceArea,
      fares: results,
    };
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

    if (dto.decision === 'interested') {
      // Throws if the driver's wallet can't cover this ride's commission —
      // must happen before the response row is saved so an ineligible
      // "interested" is never persisted.
      await this.walletService.createHoldIfEligible(
        driverId,
        rideRequestId,
        Number(rideRequest.companyCommission),
      );
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

    if (dto.decision === 'declined') {
      await this.walletService.releaseHold(driverId, rideRequestId);
    }

    alert.isRead = true;
    alert.inAppStatus = 'opened';
    await this.driverRideAlertRepository.save(alert);
    // Notify rider in real-time about this response
    try {
      const ride = await this.rideRequestRepository.findOne({ where: { id: rideRequestId } });
      if (ride) {
        this.gateway.notifyRiderResponse(ride.riderId, {
          rideRequestId,
          driverId,
          decision: response.decision,
          counterOfferPrice:
            response.counterOfferPrice !== null ? Number(response.counterOfferPrice) : null,
          message: response.message,
          createdAt: response.createdAt,
        });
      }
    } catch (err) {
      console.warn('Realtime rider notify failed:', err);
    }

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

    // Every other driver who responded "interested" was never chosen — free
    // up their held commission amount now rather than making them wait for
    // this ride to complete.
    await this.walletService.releaseAllHoldsForRideExcept(rideRequestId, driverId);

    // Notify rider and driver in real-time
    try {
      this.gateway.notifyDriverSelected(rideRequest.riderId, driverId, {
        rideRequestId,
        driverId,
        selectedAt: rideRequest.selectedAt,
      });
    } catch (err) {
      console.warn('Realtime notify selected driver failed:', err);
    }

    // Auto-join connected rider/driver sockets to chat room and notify them
    try {
      await this.gateway.joinUsersToChatRoom(rideRequest.id, rideRequest.riderId, driverId);
    } catch (err) {
      console.warn('Failed to join users to chat room:', err);
    }

    const selectedDriver = await this.userRepository.findOne({ where: { id: driverId } });

    return {
      message: 'Driver selected successfully',
      rideRequest: this.formatRideRequest(rideRequest, selectedDriver ?? undefined),
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

  async completeRideRequest(driverId: string, rideRequestId: string) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.selectedDriverId !== driverId) {
      throw new ForbiddenException('Only the selected driver can complete this ride');
    }

    if (rideRequest.status !== 'driver_selected') {
      throw new BadRequestException('Ride must be in driver_selected status to be completed');
    }

    // The rider chose the payment method up front when creating the ride
    // request; the driver has no say in it here.
    const paymentMethod = rideRequest.paymentMethod;

    if (paymentMethod !== 'online' && paymentMethod !== 'cash') {
      throw new BadRequestException('Ride request has no valid payment method set');
    }

    rideRequest.status = 'completed';
    rideRequest.completedAt = new Date();
    await this.rideRequestRepository.save(rideRequest);

    // The rider now pays the driver directly (cash in hand, or a direct
    // JazzCash transfer) for both payment methods — the platform never holds
    // the fare, so commission is always just a wallet debit here.
    let walletResult: { balance: number } | null = null;
    const commission = Number(rideRequest.companyCommission);

    if (commission > 0) {
      const result = await this.walletService.captureHoldAndDebitCommissionIfNotAlready(
        driverId,
        commission,
        rideRequestId,
        `Company commission for ${paymentMethod} ride ${rideRequestId}`,
      );

      if (result) {
        walletResult = { balance: result.balance };
      }
    }

    return {
      message: 'Ride marked completed. Commission deducted from your wallet.',
      rideRequest: this.formatRideRequest(rideRequest),
      wallet: walletResult,
    };
  }

  async cancelRideRequest(riderId: string, rideRequestId: string) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.riderId !== riderId) {
      throw new ForbiddenException('You can only cancel your own ride request');
    }

    if (rideRequest.status !== 'open' && rideRequest.status !== 'driver_selected') {
      throw new BadRequestException('Ride request can no longer be cancelled');
    }

    rideRequest.status = 'cancelled';
    rideRequest.cancelledAt = new Date();
    await this.rideRequestRepository.save(rideRequest);

    // Releases the selected driver's hold (if one had been made), or every
    // interested driver's hold if no one had been selected yet.
    await this.walletService.releaseAllHoldsForRide(rideRequestId);

    try {
      this.gateway.notifyRideCancelled(rideRequest.riderId, rideRequest.selectedDriverId, {
        rideRequestId,
        cancelledAt: rideRequest.cancelledAt,
      });
    } catch (err) {
      console.warn('Realtime notify ride cancelled failed:', err);
    }

    return {
      message: 'Ride request cancelled successfully',
      rideRequest: this.formatRideRequest(rideRequest),
    };
  }

  async getChatMessages(userId: string, rideRequestId: string) {
    const ride = await this.rideRequestRepository.findOne({ where: { id: rideRequestId } });

    if (!ride) {
      throw new NotFoundException('Ride request not found');
    }

    // Only allow rider or selected driver (or driver if not selected but targeted?) to fetch chat
    const isParticipant = userId === ride.riderId || userId === ride.selectedDriverId;

    if (!isParticipant) {
      throw new ForbiddenException('You are not authorized to view this chat');
    }

    return this.chatService.getMessages(rideRequestId);
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

  private formatRideRequest(rideRequest: RideRequest, driver?: User) {
    const driverPaymentDetails =
      rideRequest.paymentMethod === 'online' && driver
        ? {
            jazzcashAccountNumber: driver.jazzcash_account_number,
            jazzcashAccountTitle: driver.jazzcash_account_title,
          }
        : undefined;

    return {
      id: rideRequest.id,
      riderId: rideRequest.riderId,
      pickupLocation: rideRequest.pickupLocation,
      pickupArea: rideRequest.pickupArea,
      dropoffLocation: rideRequest.dropoffLocation,
      vehicleType: rideRequest.vehicleType,
      serviceArea: rideRequest.serviceArea,
      offeredPrice: Number(rideRequest.offeredPrice),
      estimatedDistanceKm: Number(rideRequest.estimatedDistanceKm),
      companyCommission: Number(rideRequest.companyCommission),
      driverPayout: Number(rideRequest.driverPayout),
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
      paymentMethod: rideRequest.paymentMethod,
      completedAt: rideRequest.completedAt,
      cancelledAt: rideRequest.cancelledAt,
      createdAt: rideRequest.createdAt,
      updatedAt: rideRequest.updatedAt,
      ...(driverPaymentDetails ? { driverPaymentDetails } : {}),
    };
  }

  private resolveTargetArea(
    pickupArea: string | undefined,
    pickupLocation: string,
    dropoffLocation?: string,
  ): string {
    const normalizedPickupArea = pickupArea ? normalizeAreaText(pickupArea) : '';

    // Prefer a location-derived city/area when the explicit pickupArea is too broad
    // (for example: "pakistan" or another country-level token).
    if (normalizedPickupArea && !this.isBroadAreaToken(normalizedPickupArea)) {
      return normalizedPickupArea;
    }

    // Try to extract area from pickup location
    let derivedArea = resolveAreaFromLocationText(pickupLocation);

    // If pickup location is generic (e.g., "Current location"), try dropoff instead
    if (derivedArea.length === 0 || isGenericLocationString(pickupLocation)) {
      if (dropoffLocation) {
        console.log(
          `[Area Resolution] Pickup location "${pickupLocation}" is generic or empty. Falling back to dropoff location.`,
        );
        derivedArea = resolveAreaFromLocationText(dropoffLocation);
      }
    }

    if (derivedArea.length > 0) {
      return derivedArea;
    }

    throw new BadRequestException(
      'Unable to determine pickup area from pickup location or dropoff location',
    );
  }

  private isBroadAreaToken(area: string): boolean {
    return new Set([
      'pakistan',
      'india',
      'usa',
      'united states',
      'united kingdom',
      'uk',
      'state',
      'province',
      'county',
    ]).has(area);
  }

  private areasMatch(driverArea: string, targetArea: string): boolean {
    if (!driverArea || !targetArea) return false;
    if (driverArea === targetArea) return true;

    // Allow specific and broader forms to match, e.g. "bahawalpur" and "bahawalpur pakistan".
    return driverArea.includes(targetArea) || targetArea.includes(driverArea);
  }

  private resolveEstimatedDistanceKm(dto: CreateRideRequestDto): number {
    if (
      dto.pickupLatitude === undefined ||
      dto.pickupLongitude === undefined ||
      dto.dropoffLatitude === undefined ||
      dto.dropoffLongitude === undefined
    ) {
      throw new BadRequestException('Pickup and dropoff coordinates are required to calculate fare');
    }

    return calculateDistanceKm({
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      dropoffLatitude: dto.dropoffLatitude,
      dropoffLongitude: dto.dropoffLongitude,
    });
  }

  private resolveDriverVehicleFamily(vehicleType: string): string {
    if (vehicleType === 'bike') {
      return 'bike';
    }

    if (vehicleType === 'rikshaw') {
      return 'auto';
    }

    if (vehicleType === 'car_without_ac' || vehicleType === 'car_with_ac' || vehicleType === 'business_car') {
      return 'car';
    }

    return vehicleType;
  }

  async debugAreaResolution(pickupArea: string | undefined, pickupLocation: string, dropoffLocation?: string) {
    const resolvedArea = this.resolveTargetArea(pickupArea, pickupLocation, dropoffLocation);

    // Fetch all drivers with approved status and car vehicle type
    const allCarDrivers = await this.driverRegistrationRepository.find({
      where: { status: 'approved', vehicleType: 'car' },
    });

    const matchingDrivers = allCarDrivers.filter(
      (driverReg) => normalizeAreaText(driverReg.operatingArea) === resolvedArea,
    );

    return {
      input: {
        pickupArea: pickupArea || '(not provided)',
        pickupLocation,
      },
      resolvedArea,
      allCarDrivers: allCarDrivers.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        operatingArea: d.operatingArea,
        normalizedOperatingArea: normalizeAreaText(d.operatingArea),
        vehicleType: d.vehicleType,
      })),
      matchingDrivers: matchingDrivers.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        operatingArea: d.operatingArea,
      })),
      matchCount: matchingDrivers.length,
      note: 'This shows all drivers with status=approved and vehicleType=car, and filters by area match. The resolvedArea is what will be used to match drivers.',
    };
  }
}
