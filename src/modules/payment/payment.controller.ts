import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InitiateJazzCashPaymentDto } from './dto/initiate-jazzcash-payment.dto';
import { PaymentService } from './services/payment.service';

@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('jazzcash/initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async initiateJazzCashPayment(
    @Request() req: any,
    @Body() dto: InitiateJazzCashPaymentDto,
  ) {
    return this.paymentService.initiateJazzCashPayment(
      req.user.id,
      dto.rideRequestId,
      dto.description,
    );
  }

  @Post('jazzcash/callback')
  async jazzCashCallback(@Req() req: ExpressRequest, @Res() res: Response) {
    const payload = req.body as Record<string, string>;
    const { redirectUrl, payment } = await this.paymentService.handleJazzCashCallback(payload);

    const url = new URL(redirectUrl);
    if (payment) {
      url.searchParams.set('paymentId', payment.id);
      url.searchParams.set('status', payment.status);
      url.searchParams.set('txnRefNo', payment.txnRefNo);
    }

    return res.redirect(url.toString());
  }

  @Get('jazzcash/:paymentId/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getPaymentStatus(@Request() req: any, @Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentStatus(req.user.id, paymentId);
  }

  @Post('jazzcash/:paymentId/inquire')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async inquireJazzCashPayment(@Request() req: any, @Param('paymentId') paymentId: string) {
    return this.paymentService.inquireAndSync(req.user.id, paymentId);
  }

  @Get('ride/:rideRequestId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getPaymentsForRide(@Request() req: any, @Param('rideRequestId') rideRequestId: string) {
    return this.paymentService.getPaymentsForRide(req.user.id, rideRequestId);
  }
}
