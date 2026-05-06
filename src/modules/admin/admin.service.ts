import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverRegistration } from '../driver-registration/entities/driver-registration.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(DriverRegistration)
    private readonly driverRegistrationRepository: Repository<DriverRegistration>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listDriverRegistrations(status?: string) {
    const where = status ? { status } : {};
    const registrations = await this.driverRegistrationRepository.find({ where });
    return { registrations };
  }

  async getDriverRegistration(id: string) {
    const registration = await this.driverRegistrationRepository.findOne({ where: { id } });
    if (!registration) {
      throw new NotFoundException('Driver registration not found');
    }
    return { registration };
  }

  async approveDriverRegistration(id: string) {
    const registration = await this.driverRegistrationRepository.findOne({ where: { id } });
    if (!registration) {
      throw new NotFoundException('Driver registration not found');
    }

    registration.status = 'approved';
    await this.driverRegistrationRepository.save(registration);

    // mark user as driver
    const user = await this.userRepository.findOne({ where: { id: registration.userId } });
    if (user) {
      user.is_driver = true;
      await this.userRepository.save(user);
    }

    return { message: 'Driver registration approved', registration };
  }

  async rejectDriverRegistration(id: string, reason?: string) {
    const registration = await this.driverRegistrationRepository.findOne({ where: { id } });
    if (!registration) {
      throw new NotFoundException('Driver registration not found');
    }

    registration.status = 'rejected';
    await this.driverRegistrationRepository.save(registration);

    // optionally could notify user via email here

    return { message: 'Driver registration rejected', registration, reason };
  }
}
