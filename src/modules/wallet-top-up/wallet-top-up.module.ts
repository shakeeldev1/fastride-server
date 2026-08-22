import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { JazzcashModule } from '../jazzcash/jazzcash.module';
import { User } from '../user/entities/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { WalletTopUp } from '../wallet/entities/wallet-top-up.entity';
import { WalletTopUpController } from './wallet-top-up.controller';
import { WalletTopUpService } from './services/wallet-top-up.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletTopUp, User]),
    AuthModule,
    WalletModule,
    JazzcashModule,
  ],
  controllers: [WalletTopUpController],
  providers: [WalletTopUpService],
})
export class WalletTopUpModule {}
