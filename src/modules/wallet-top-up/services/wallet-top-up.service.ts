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
import { JazzCashService } from '../../jazzcash/jazzcash.service';
import { User } from '../../user/entities/user.entity';
import { WalletService } from '../../wallet/services/wallet.service';
import { WalletTopUp } from '../../wallet/entities/wallet-top-up.entity';

@Injectable()
export class WalletTopUpService {
  private readonly logger = new Logger(WalletTopUpService.name);
  private readonly frontendSuccessUrl: string;
  private readonly frontendFailureUrl: string;
  private readonly txnExpiryMinutes: number;

  constructor(
    @InjectRepository(WalletTopUp)
    private readonly walletTopUpRepository: Repository<WalletTopUp>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jazzCashService: JazzCashService,
    private readonly walletService: WalletService,
  ) {
    const config = getJazzCashConfig();
    this.frontendSuccessUrl = config.frontendSuccessUrl;
    this.frontendFailureUrl = config.frontendFailureUrl;
    this.txnExpiryMinutes = config.txnExpiryMinutes;
  }

  async initiate(userId: string, amount: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_driver) {
      throw new ForbiddenException('Only drivers can top up a wallet');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('Top-up amount must be greater than 0');
    }

    // Reuse an in-flight pending top-up for the same amount instead of
    // minting a new pp_TxnRefNo every time, same reasoning as ride-payment
    // checkout reuse: avoids a rider/driver getting charged twice for the
    // same intended top-up on a retried initiate.
    const existingPending = await this.walletTopUpRepository.findOne({
      where: { userId, amount: amount.toFixed(2), status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    let topUp: WalletTopUp;

    if (existingPending && !this.isExpired(existingPending)) {
      topUp = existingPending;
    } else {
      if (existingPending) {
        existingPending.status = 'expired';
        await this.walletTopUpRepository.save(existingPending);
      }

      topUp = this.walletTopUpRepository.create({
        userId,
        provider: 'jazzcash',
        amount: amount.toFixed(2),
        currency: 'PKR',
        status: 'pending',
        txnRefNo: this.jazzCashService.generateTxnRefNo(),
        billReference: userId.replace(/-/g, '').slice(0, 20),
        expiresAt: new Date(Date.now() + this.txnExpiryMinutes * 60 * 1000),
      });

      await this.walletTopUpRepository.save(topUp);
    }

    const { checkoutUrl, fields } = this.jazzCashService.buildHostedCheckoutRequest({
      txnRefNo: topUp.txnRefNo,
      amount,
      billReference: topUp.billReference as string,
      description: `FastRide wallet top-up ${topUp.id}`,
    });

    return {
      message: 'JazzCash checkout initiated',
      topUpId: topUp.id,
      txnRefNo: topUp.txnRefNo,
      checkoutUrl,
      fields,
    };
  }

  private isExpired(topUp: WalletTopUp): boolean {
    if (!topUp.expiresAt) {
      return true;
    }

    return Date.now() > topUp.expiresAt.getTime();
  }

  async handleJazzCashCallback(payload: Record<string, string>) {
    const isHashValid = this.jazzCashService.verifySecureHash(payload);
    const txnRefNo = payload['pp_TxnRefNo'];

    if (!txnRefNo) {
      this.logger.warn('JazzCash top-up callback received without pp_TxnRefNo');
      return { redirectUrl: this.frontendFailureUrl };
    }

    const topUp = await this.walletTopUpRepository.findOne({ where: { txnRefNo } });

    if (!topUp) {
      this.logger.warn(`JazzCash top-up callback for unknown txnRefNo=${txnRefNo}`);
      return { redirectUrl: this.frontendFailureUrl };
    }

    if (!isHashValid) {
      this.logger.error(`JazzCash top-up callback secure hash mismatch for txnRefNo=${txnRefNo}`);
      topUp.status = 'failed';
      topUp.jazzcashResponseMessage = 'Secure hash verification failed';
      topUp.rawCallbackPayload = payload;
      await this.walletTopUpRepository.save(topUp);
      return { redirectUrl: this.frontendFailureUrl, topUp };
    }

    const responseCode = payload['pp_ResponseCode'];
    const responseMessage = payload['pp_ResponseMessage'];
    const wasAlreadyCompleted = topUp.status === 'completed';

    topUp.jazzcashResponseCode = responseCode ?? null;
    topUp.jazzcashResponseMessage = responseMessage ?? null;
    topUp.jazzcashRetrievalReferenceNo = payload['pp_RetreivalReferenceNo'] ?? null;
    topUp.jazzcashAuthCode = payload['pp_AuthCode'] ?? null;
    topUp.rawCallbackPayload = payload;

    const expectedAmountInPaisa = Math.round(Number(topUp.amount) * 100);
    const callbackAmountInPaisa = Number(payload['pp_Amount']);
    const amountMatches =
      !payload['pp_Amount'] || callbackAmountInPaisa === expectedAmountInPaisa;

    if (this.jazzCashService.isSuccessResponseCode(responseCode) && !amountMatches) {
      this.logger.error(
        `JazzCash top-up callback amount mismatch for txnRefNo=${txnRefNo}: expected ${expectedAmountInPaisa}, got ${payload['pp_Amount']}`,
      );
      topUp.status = 'failed';
      topUp.jazzcashResponseMessage = 'Amount mismatch between recorded top-up and callback';
    } else if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      topUp.status = 'completed';
      topUp.paidAt = topUp.paidAt ?? new Date();
    } else {
      topUp.status = 'failed';
    }

    await this.walletTopUpRepository.save(topUp);

    if (!wasAlreadyCompleted && topUp.status === 'completed') {
      await this.creditWalletForTopUp(topUp);
    }

    const redirectUrl =
      topUp.status === 'completed' ? this.frontendSuccessUrl : this.frontendFailureUrl;

    return { redirectUrl, topUp };
  }

  private async creditWalletForTopUp(topUp: WalletTopUp) {
    try {
      await this.walletService.credit(
        topUp.userId,
        Number(topUp.amount),
        'wallet_top_up',
        null,
        `Wallet top-up ${topUp.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to credit wallet for top-up ${topUp.id}: ${(error as Error).message}`,
      );
    }
  }

  async getStatus(userId: string, topUpId: string) {
    const topUp = await this.walletTopUpRepository.findOne({ where: { id: topUpId } });

    if (!topUp) {
      throw new NotFoundException('Top-up not found');
    }

    if (topUp.userId !== userId) {
      throw new ForbiddenException('You can only view your own top-ups');
    }

    return { topUp: this.formatTopUp(topUp) };
  }

  async inquireAndSync(userId: string, topUpId: string) {
    const topUp = await this.walletTopUpRepository.findOne({ where: { id: topUpId } });

    if (!topUp) {
      throw new NotFoundException('Top-up not found');
    }

    if (topUp.userId !== userId) {
      throw new ForbiddenException('You can only inquire about your own top-ups');
    }

    if (topUp.status === 'completed') {
      return { topUp: this.formatTopUp(topUp) };
    }

    const inquiryResult = await this.jazzCashService.inquireTransaction(topUp.txnRefNo);
    const responseCode = inquiryResult['pp_ResponseCode'];
    const wasAlreadyCompleted = topUp.status === 'completed';

    topUp.jazzcashResponseCode = responseCode ?? topUp.jazzcashResponseCode;
    topUp.jazzcashResponseMessage =
      inquiryResult['pp_ResponseMessage'] ?? topUp.jazzcashResponseMessage;

    if (this.jazzCashService.isSuccessResponseCode(responseCode)) {
      topUp.status = 'completed';
      topUp.paidAt = topUp.paidAt ?? new Date();
    }

    await this.walletTopUpRepository.save(topUp);

    if (!wasAlreadyCompleted && topUp.status === 'completed') {
      await this.creditWalletForTopUp(topUp);
    }

    return { topUp: this.formatTopUp(topUp) };
  }

  private formatTopUp(topUp: WalletTopUp) {
    return {
      id: topUp.id,
      userId: topUp.userId,
      provider: topUp.provider,
      amount: Number(topUp.amount),
      currency: topUp.currency,
      status: topUp.status,
      txnRefNo: topUp.txnRefNo,
      jazzcashResponseCode: topUp.jazzcashResponseCode,
      jazzcashResponseMessage: topUp.jazzcashResponseMessage,
      paidAt: topUp.paidAt,
      createdAt: topUp.createdAt,
      updatedAt: topUp.updatedAt,
    };
  }
}
