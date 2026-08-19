import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepository: Repository<WalletTransaction>,
  ) {}

  private isUniqueViolation(error: unknown): boolean {
    const code = (error as any)?.code ?? (error as any)?.driverError?.code;
    return code === '23505';
  }

  /**
   * Applies a balance mutation and its ledger row atomically under a row lock
   * on the user, so concurrent requests (double-tap, retried webhook, racing
   * withdrawal requests) can never observe a stale balance.
   *
   * `validateUnderLock` runs AFTER the row lock is acquired (with the
   * up-to-date balance), not before — callers that need a balance-sufficiency
   * check (e.g. withdrawals) must pass it here rather than checking balance
   * beforehand, otherwise two concurrent requests can both pass a pre-check
   * against the same stale balance and overdraw.
   */
  private async applyLedgerEntry(params: {
    userId: string;
    signedAmount: number;
    type: string;
    rideRequestId?: string | null;
    description?: string | null;
    status?: string;
    validateUnderLock?: (currentBalance: number) => void;
  }): Promise<{ balance: number; transaction: WalletTransaction }> {
    return this.userRepository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const walletTxRepo = manager.getRepository(WalletTransaction);

      const user = await userRepo
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: params.userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const currentBalance = Number(user.wallet_balance ?? 0);

      if (params.validateUnderLock) {
        params.validateUnderLock(currentBalance);
      }

      const newBalance = Number((currentBalance + params.signedAmount).toFixed(2));

      user.wallet_balance = newBalance.toFixed(2);
      await userRepo.save(user);

      const transaction = walletTxRepo.create({
        userId: params.userId,
        type: params.type,
        amount: params.signedAmount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        rideRequestId: params.rideRequestId ?? null,
        description: params.description ?? null,
        status: params.status ?? 'completed',
      });
      // A DB-level UNIQUE (ride_request_id, type) constraint is the real guard
      // against double-crediting/double-debiting the same ride (e.g. a retried
      // JazzCash webhook racing a manual /inquire call) — a prior SELECT-then-
      // insert check has a TOCTOU gap that this closes.
      await walletTxRepo.save(transaction);

      return { balance: newBalance, transaction };
    });
  }

  async credit(
    userId: string,
    amount: number,
    type: string,
    rideRequestId: string | null,
    description: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Credit amount must be greater than 0');
    }

    return this.applyLedgerEntry({ userId, signedAmount: amount, type, rideRequestId, description });
  }

  async debit(
    userId: string,
    amount: number,
    type: string,
    rideRequestId: string | null,
    description: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Debit amount must be greater than 0');
    }

    return this.applyLedgerEntry({
      userId,
      signedAmount: -Math.abs(amount),
      type,
      rideRequestId,
      description,
    });
  }

  /**
   * Credits ride earnings exactly once per rideRequestId. Relies on the
   * wallet_transactions UNIQUE (ride_request_id, type) constraint rather than
   * a SELECT-then-insert check, so concurrent callers (a retried JazzCash
   * webhook racing a manual /inquire call) can't both slip past a stale read
   * and double-credit the driver.
   */
  async creditRideEarningIfNotAlready(
    driverId: string,
    amount: number,
    rideRequestId: string,
    description: string,
  ) {
    if (amount <= 0) {
      return null;
    }

    try {
      return await this.applyLedgerEntry({
        userId: driverId,
        signedAmount: amount,
        type: 'ride_earning',
        rideRequestId,
        description,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async debitCashCommissionIfNotAlready(
    driverId: string,
    amount: number,
    rideRequestId: string,
    description: string,
  ) {
    if (amount <= 0) {
      return null;
    }

    try {
      return await this.applyLedgerEntry({
        userId: driverId,
        signedAmount: -Math.abs(amount),
        type: 'commission_debit',
        rideRequestId,
        description,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  private async requireDriver(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_driver) {
      throw new ForbiddenException('Only drivers have a wallet');
    }

    return user;
  }

  async getWalletSummary(userId: string) {
    const user = await this.requireDriver(userId);

    const recentTransactions = await this.walletTransactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      balance: Number(user.wallet_balance ?? 0),
      recentTransactions: recentTransactions.map((tx) => this.formatTransaction(tx)),
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    await this.requireDriver(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const [transactions, total] = await this.walletTransactionRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      transactions: transactions.map((tx) => this.formatTransaction(tx)),
      pagination: { page: safePage, limit: safeLimit, total },
    };
  }

  async requestWithdrawal(userId: string, amount: number) {
    // Only used to enforce "drivers only" up front; the actual balance check
    // must happen under the row lock inside applyLedgerEntry (see
    // validateUnderLock below) so two concurrent withdrawal requests can't
    // both pass a check against the same stale balance and overdraw.
    await this.requireDriver(userId);

    const { balance, transaction } = await this.applyLedgerEntry({
      userId,
      signedAmount: -Math.abs(amount),
      type: 'withdrawal',
      description: 'Withdrawal request pending admin payout',
      status: 'pending',
      validateUnderLock: (currentBalance) => {
        if (amount > currentBalance) {
          throw new BadRequestException('Withdrawal amount exceeds available wallet balance');
        }
      },
    });

    return {
      message: 'Withdrawal requested. Funds will be transferred by the admin team.',
      balance,
      transaction: this.formatTransaction(transaction),
    };
  }

  async listWithdrawals(status?: string) {
    const where = status ? { type: 'withdrawal', status } : { type: 'withdrawal' };

    const withdrawals = await this.walletTransactionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return { withdrawals: withdrawals.map((tx) => this.formatTransaction(tx)) };
  }

  async completeWithdrawal(withdrawalId: string) {
    const withdrawal = await this.walletTransactionRepository.findOne({
      where: { id: withdrawalId, type: 'withdrawal' },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Only pending withdrawals can be completed');
    }

    withdrawal.status = 'completed';
    await this.walletTransactionRepository.save(withdrawal);

    return { message: 'Withdrawal marked as completed', transaction: this.formatTransaction(withdrawal) };
  }

  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const withdrawal = await this.walletTransactionRepository.findOne({
      where: { id: withdrawalId, type: 'withdrawal' },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Only pending withdrawals can be rejected');
    }

    const refundAmount = Math.abs(Number(withdrawal.amount));

    await this.applyLedgerEntry({
      userId: withdrawal.userId,
      signedAmount: refundAmount,
      type: 'withdrawal_rejected_refund',
      rideRequestId: withdrawal.rideRequestId,
      description: `Refund for rejected withdrawal ${withdrawal.id}`,
    });

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason ?? null;
    await this.walletTransactionRepository.save(withdrawal);

    return { message: 'Withdrawal rejected and refunded to wallet', transaction: this.formatTransaction(withdrawal) };
  }

  private formatTransaction(transaction: WalletTransaction) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balanceAfter),
      rideRequestId: transaction.rideRequestId,
      description: transaction.description,
      status: transaction.status,
      rejectionReason: transaction.rejectionReason,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
