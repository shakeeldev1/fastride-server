import { Module } from '@nestjs/common';
import { JazzCashService } from './jazzcash.service';

@Module({
  providers: [JazzCashService],
  exports: [JazzCashService],
})
export class JazzcashModule {}
