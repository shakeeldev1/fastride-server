import { Body, Controller, Get, HttpCode, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { WalletService } from './services/wallet.service';

@Controller('api/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @HttpCode(200)
  async getMyWallet(@Request() req: any) {
    return this.walletService.getWalletSummary(req.user.id);
  }

  @Get('transactions')
  @HttpCode(200)
  async getMyTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(
      req.user.id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('withdraw')
  @HttpCode(201)
  async requestWithdrawal(@Request() req: any, @Body() dto: RequestWithdrawalDto) {
    return this.walletService.requestWithdrawal(req.user.id, dto.amount);
  }
}
