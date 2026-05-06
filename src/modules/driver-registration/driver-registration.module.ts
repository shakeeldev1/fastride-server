import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { User } from '../user/entities/user.entity';
import { DriverRegistrationController } from './driver-registration.controller';
import { DriverRegistration } from './entities/driver-registration.entity';
import { DriverRegistrationService } from './services/driver-registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([DriverRegistration, User]), UserModule],
  controllers: [DriverRegistrationController],
  providers: [DriverRegistrationService],
})
export class DriverRegistrationModule {}