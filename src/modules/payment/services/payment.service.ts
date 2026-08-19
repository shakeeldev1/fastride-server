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
import { Payment } from '../entities/payment.entity';
import { JazzCashService } from './jazzcash.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly frontendSuccessUrl: string;
  private readonly frontendFailureUrl: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(RideRequest)
    private readonly rideRequestRepository: Repository<RideRequest>,
    private readonly jazzCashService: JazzCashService,
  ) {
    const config = getJazzCashConfig();
    this.frontendSuccessUrl = config.frontendSuccessUrl;
    this.frontendFailureUrl = config.frontendFailureUrl;
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

    const amount = Number(rideRequest.offeredPrice);

    if (!amount || amount <= 0) {
      throw new BadRequestException('Ride request does not have a valid payable amount');
    }

    const txnRefNo = this.jazzCashService.generateTxnRefNo();

    const payment = this.paymentRepository.create({
      rideRequestId,
      riderId,
      provider: 'jazzcash',
      amount: amount.toFixed(2),
      currency: 'PKR',
      status: 'pending',
      txnRefNo,
      billReference: rideRequestId.replace(/-/g, '').slice(0, 20),
    });

    await this.paymentRepository.save(payment);

    const { checkoutUrl, fields } = this.jazzCashService.buildHostedCheckoutRequest({
      txnRefNo,
      amount,
      billReference: payment.billReference as string,
      description: description || `FastRide ride payment ${rideRequestId}`,
    });

    return {
      message: 'JazzCash checkout initiated',
      paymentId: payment.id,
      txnRefNo,
      checkoutUrl,
      fields,
    };
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

    payment.jazzcashResponseCode = responseCode ?? null;
    payment.jazzcashResponseMessage = responseMessage ?? null;
    payment.jazzcashRetrievalReferenceNo = payload['pp_RetreivalReferenceNo'] ?? null;
    payment.jazzcashAuthCode = payload['pp_AuthCode'] ?? null;
    payment.rawCallbackPayload = payload;

    if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      payment.status = 'completed';
      payment.paidAt = new Date();
    } else {
      payment.status = 'failed';
    }

    await this.paymentRepository.save(payment);

    const redirectUrl =
      payment.status === 'completed' ? this.frontendSuccessUrl : this.frontendFailureUrl;

    return { redirectUrl, payment };
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

    payment.jazzcashResponseCode = responseCode ?? payment.jazzcashResponseCode;
    payment.jazzcashResponseMessage =
      inquiryResult['pp_ResponseMessage'] ?? payment.jazzcashResponseMessage;

    if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      payment.status = 'completed';
      payment.paidAt = payment.paidAt ?? new Date();
    }

    await this.paymentRepository.save(payment);

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
