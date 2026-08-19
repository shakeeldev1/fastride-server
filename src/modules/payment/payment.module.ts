import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RideRequest } from '../ride-request/entities/ride-request.entity';
import { WalletModule } from '../wallet/wallet.module';
import { Payment } from './entities/payment.entity';
import { PaymentController } from './payment.controller';
import { JazzCashService } from './services/jazzcash.service';
import { PaymentService } from './services/payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, RideRequest]), AuthModule, WalletModule],
  controllers: [PaymentController],
  providers: [PaymentService, JazzCashService],
  exports: [PaymentService],
})
export class PaymentModule {}
