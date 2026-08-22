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
import { InitiateTopUpDto } from './dto/initiate-top-up.dto';
import { WalletTopUpService } from './services/wallet-top-up.service';

@Controller('api/wallet/topup')
export class WalletTopUpController {
  constructor(private readonly walletTopUpService: WalletTopUpService) {}

  @Post('jazzcash/initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async initiate(@Request() req: any, @Body() dto: InitiateTopUpDto) {
    return this.walletTopUpService.initiate(req.user.id, dto.amount);
  }

  @Post('jazzcash/callback')
  async jazzCashCallback(@Req() req: ExpressRequest, @Res() res: Response) {
    const payload = req.body as Record<string, string>;
    const { redirectUrl, topUp } = await this.walletTopUpService.handleJazzCashCallback(payload);

    const url = new URL(redirectUrl);
    if (topUp) {
      url.searchParams.set('topUpId', topUp.id);
      url.searchParams.set('status', topUp.status);
      url.searchParams.set('txnRefNo', topUp.txnRefNo);
    }

    return res.redirect(url.toString());
  }

  @Get(':topUpId/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async getStatus(@Request() req: any, @Param('topUpId') topUpId: string) {
    return this.walletTopUpService.getStatus(req.user.id, topUpId);
  }

  @Post(':topUpId/inquire')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async inquire(@Request() req: any, @Param('topUpId') topUpId: string) {
    return this.walletTopUpService.inquireAndSync(req.user.id, topUpId);
  }
}
