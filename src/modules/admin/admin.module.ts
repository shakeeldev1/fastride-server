import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverRegistration } from '../driver-registration/entities/driver-registration.entity';
import { User } from '../user/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([DriverRegistration, User])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
