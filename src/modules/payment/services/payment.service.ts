import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getJazzCashConfig } from '../../../config/jazzcash.config';
import { RideRequest } from '../../ride-request/entities/ride-request.entity';
import { WalletService } from '../../wallet/services/wallet.service';
import { Payment } from '../entities/payment.entity';
import { JazzCashService } from './jazzcash.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly frontendSuccessUrl: string;
  private readonly frontendFailureUrl: string;
  private readonly txnExpiryMinutes: number;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RideRequest)
    private readonly rideRequestRepository: Repository<RideRequest>,
    private readonly jazzCashService: JazzCashService,
    private readonly walletService: WalletService,
  ) {
    const config = getJazzCashConfig();
    this.frontendSuccessUrl = config.frontendSuccessUrl;
    this.frontendFailureUrl = config.frontendFailureUrl;
    this.txnExpiryMinutes = config.txnExpiryMinutes;
  }

  async initiateJazzCashPayment(
    riderId: string,
    rideRequestId: string,
    description?: string,
  ) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.riderId !== riderId) {
      throw new ForbiddenException('You can only pay for your own ride request');
    }

    const existingCompletedPayment = await this.paymentRepository.findOne({
      where: { rideRequestId, status: 'completed' },
    });

    if (existingCompletedPayment) {
      throw new BadRequestException('This ride request has already been paid for');
    }

    if (rideRequest.status !== 'completed') {
      throw new BadRequestException(
        'The driver must mark this ride as completed before online payment can be initiated',
      );
    }

    if (rideRequest.paymentMethod === 'cash') {
      throw new BadRequestException('This ride was already settled with cash payment');
    }

    const amount = Number(rideRequest.offeredPrice);

    if (!amount || amount <= 0) {
      throw new BadRequestException('Ride request does not have a valid payable amount');
    }

    // Reuse an in-flight pending payment instead of minting a new pp_TxnRefNo
    // every time the rider re-opens checkout. Without this, a rider who
    // completes checkout on an earlier attempt (browser back/refresh, retry)
    // and then triggers a fresh initiate could end up with two live checkout
    // sessions and get charged twice by JazzCash for the same ride.
    const existingPendingPayment = await this.paymentRepository.findOne({
      where: { rideRequestId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    let payment: Payment;

    if (existingPendingPayment && !this.isExpired(existingPendingPayment)) {
      payment = existingPendingPayment;
    } else {
      if (existingPendingPayment) {
        existingPendingPayment.status = 'expired';
        await this.paymentRepository.save(existingPendingPayment);
      }

      payment = this.paymentRepository.create({
        rideRequestId,
        riderId,
        provider: 'jazzcash',
        amount: amount.toFixed(2),
        currency: 'PKR',
        status: 'pending',
        txnRefNo: this.jazzCashService.generateTxnRefNo(),
        billReference: rideRequestId.replace(/-/g, '').slice(0, 20),
        expiresAt: new Date(Date.now() + this.txnExpiryMinutes * 60 * 1000),
      });

      await this.paymentRepository.save(payment);
    }

    const { checkoutUrl, fields } = this.jazzCashService.buildHostedCheckoutRequest({
      txnRefNo: payment.txnRefNo,
      amount,
      billReference: payment.billReference as string,
      description: description || `FastRide ride payment ${rideRequestId}`,
    });

    return {
      message: 'JazzCash checkout initiated',
      paymentId: payment.id,
      txnRefNo: payment.txnRefNo,
      checkoutUrl,
      fields,
    };
  }

  private isExpired(payment: Payment): boolean {
    if (!payment.expiresAt) {
      return true;
    }

    return Date.now() > payment.expiresAt.getTime();
  }

  async handleJazzCashCallback(payload: Record<string, string>) {
    const isHashValid = this.jazzCashService.verifySecureHash(payload);
    const txnRefNo = payload['pp_TxnRefNo'];

    if (!txnRefNo) {
      this.logger.warn('JazzCash callback received without pp_TxnRefNo');
      return { redirectUrl: this.frontendFailureUrl };
    }

    const payment = await this.paymentRepository.findOne({ where: { txnRefNo } });

    if (!payment) {
      this.logger.warn(`JazzCash callback for unknown txnRefNo=${txnRefNo}`);
      return { redirectUrl: this.frontendFailureUrl };
    }

    if (!isHashValid) {
      this.logger.error(`JazzCash callback secure hash mismatch for txnRefNo=${txnRefNo}`);
      payment.status = 'failed';
      payment.jazzcashResponseMessage = 'Secure hash verification failed';
      payment.rawCallbackPayload = payload;
      await this.paymentRepository.save(payment);
      return { redirectUrl: this.frontendFailureUrl, payment };
    }

    const responseCode = payload['pp_ResponseCode'];
    const responseMessage = payload['pp_ResponseMessage'];
    const wasAlreadyCompleted = payment.status === 'completed';

    payment.jazzcashResponseCode = responseCode ?? null;
    payment.jazzcashResponseMessage = responseMessage ?? null;
    payment.jazzcashRetrievalReferenceNo = payload['pp_RetreivalReferenceNo'] ?? null;
    payment.jazzcashAuthCode = payload['pp_AuthCode'] ?? null;
    payment.rawCallbackPayload = payload;

    const expectedAmountInPaisa = Math.round(Number(payment.amount) * 100);
    const callbackAmountInPaisa = Number(payload['pp_Amount']);
    const amountMatches =
      !payload['pp_Amount'] || callbackAmountInPaisa === expectedAmountInPaisa;

    if (this.jazzCashService.isSuccessResponseCode(responseCode) && !amountMatches) {
      this.logger.error(
        `JazzCash callback amount mismatch for txnRefNo=${txnRefNo}: expected ${expectedAmountInPaisa}, got ${payload['pp_Amount']}`,
      );
      payment.status = 'failed';
      payment.jazzcashResponseMessage = 'Amount mismatch between recorded payment and callback';
    } else if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      payment.status = 'completed';
      payment.paidAt = payment.paidAt ?? new Date();
    } else {
      payment.status = 'failed';
    }

    await this.paymentRepository.save(payment);

    if (!wasAlreadyCompleted && payment.status === 'completed') {
      await this.creditDriverForRide(payment.rideRequestId);
    }

    const redirectUrl =
      payment.status === 'completed' ? this.frontendSuccessUrl : this.frontendFailureUrl;

    return { redirectUrl, payment };
  }

  private async creditDriverForRide(rideRequestId: string) {
    const ride = await this.rideRequestRepository.findOne({ where: { id: rideRequestId } });

    if (!ride || !ride.selectedDriverId) {
      this.logger.warn(
        `Cannot credit driver wallet for rideRequestId=${rideRequestId}: no selected driver found`,
      );
      return;
    }

    try {
      await this.walletService.creditRideEarningIfNotAlready(
        ride.selectedDriverId,
        Number(ride.driverPayout),
        ride.id,
        `Online ride earning for ${ride.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to credit driver wallet for rideRequestId=${rideRequestId}: ${(error as Error).message}`,
      );
    }
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.riderId !== userId) {
      throw new ForbiddenException('You can only view your own payments');
    }

    return { payment: this.formatPayment(payment) };
  }

  async getPaymentsForRide(userId: string, rideRequestId: string) {
    const rideRequest = await this.rideRequestRepository.findOne({
      where: { id: rideRequestId },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.riderId !== userId) {
      throw new ForbiddenException('You can only view payments for your own ride request');
    }

    const payments = await this.paymentRepository.find({
      where: { rideRequestId },
      order: { createdAt: 'DESC' },
    });

    return { payments: payments.map((payment) => this.formatPayment(payment)) };
  }

  async inquireAndSync(userId: string, paymentId: string) {
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.riderId !== userId) {
      throw new ForbiddenException('You can only inquire about your own payments');
    }

    if (payment.status === 'completed') {
      return { payment: this.formatPayment(payment) };
    }

    const inquiryResult = await this.jazzCashService.inquireTransaction(payment.txnRefNo);
    const responseCode = inquiryResult['pp_ResponseCode'];
    const wasAlreadyCompleted = payment.status === 'completed';

    payment.jazzcashResponseCode = responseCode ?? payment.jazzcashResponseCode;
    payment.jazzcashResponseMessage =
      inquiryResult['pp_ResponseMessage'] ?? payment.jazzcashResponseMessage;

    if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      payment.status = 'completed';
      payment.paidAt = payment.paidAt ?? new Date();
    }

    await this.paymentRepository.save(payment);

    if (!wasAlreadyCompleted && payment.status === 'completed') {
      await this.creditDriverForRide(payment.rideRequestId);
    }

    return { payment: this.formatPayment(payment) };
  }

  private formatPayment(payment: Payment) {
    return {
      id: payment.id,
      rideRequestId: payment.rideRequestId,
      riderId: payment.riderId,
      provider: payment.provider,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      txnRefNo: payment.txnRefNo,
      jazzcashResponseCode: payment.jazzcashResponseCode,
      jazzcashResponseMessage: payment.jazzcashResponseMessage,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
