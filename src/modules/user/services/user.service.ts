import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { SetDriverPaymentMethodDto } from '../dto/set-driver-payment-method.dto';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Profile retrieved for user: ${userId}`);
    return this.formatUserResponse(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update allowed fields
    if (updateProfileDto.name) user.name = updateProfileDto.name;
    if (updateProfileDto.bio !== undefined) user.bio = updateProfileDto.bio;
    if (updateProfileDto.address) user.address = updateProfileDto.address;
    if (updateProfileDto.city) user.city = updateProfileDto.city;
    if (updateProfileDto.state) user.state = updateProfileDto.state;
    if (updateProfileDto.postal_code) user.postal_code = updateProfileDto.postal_code;
    if (updateProfileDto.country) user.country = updateProfileDto.country;
    if (updateProfileDto.phone) user.phone = updateProfileDto.phone;

    await this.userRepository.save(user);

    this.logger.log(`Profile updated for user: ${userId}`);
    return {
      message: 'Profile updated successfully',
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Set the driver's JazzCash account details, shown to riders who pay
   * online. Only available once the driver has been approved (is_driver is
   * set together with driver_registrations.status = 'approved').
   */
  async setDriverPaymentMethod(userId: string, dto: SetDriverPaymentMethodDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_driver) {
      throw new ForbiddenException('Only approved drivers can add a payment method');
    }

    user.jazzcash_account_number = dto.jazzcashAccountNumber;
    user.jazzcash_account_title = dto.jazzcashAccountTitle;

    await this.userRepository.save(user);

    this.logger.log(`Driver payment method set for user: ${userId}`);
    return {
      message: 'Payment method saved successfully',
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(userId: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF',
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete old image if exists
    if (user.profile_picture_public_id) {
      try {
        await this.cloudinaryService.deleteImage(user.profile_picture_public_id);
      } catch (error) {
        this.logger.warn(`Failed to delete old profile picture: ${(error as Error).message}`);
      }
    }

    // Upload new image
    const uploadResult = await this.cloudinaryService.uploadImage(file, `indrive/profiles/${userId}`);

    user.profile_picture_url = uploadResult.secure_url;
    user.profile_picture_public_id = uploadResult.public_id;

    await this.userRepository.save(user);

    this.logger.log(`Profile picture uploaded for user: ${userId}`);
    return {
      message: 'Profile picture uploaded successfully',
      url: uploadResult.secure_url,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.profile_picture_public_id) {
      throw new BadRequestException('No profile picture to delete');
    }

    try {
      await this.cloudinaryService.deleteImage(user.profile_picture_public_id);
    } catch (error) {
      this.logger.error(`Failed to delete image from Cloudinary: ${(error as Error).message}`);
      throw new BadRequestException('Failed to delete profile picture');
    }

    user.profile_picture_url = null as unknown as string;
    user.profile_picture_public_id = null as unknown as string;

    await this.userRepository.save(user);

    this.logger.log(`Profile picture deleted for user: ${userId}`);
    return {
      message: 'Profile picture deleted successfully',
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.is_active) {
      throw new BadRequestException('Account is already deactivated');
    }

    user.is_active = false;
    await this.userRepository.save(user);

    this.logger.log(`Account deactivated for user: ${userId}`);
    return {
      message: 'Account deactivated successfully',
    };
  }

  /**
   * Activate user account
   */
  async activateAccount(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_active) {
      throw new BadRequestException('Account is already active');
    }

    user.is_active = true;
    await this.userRepository.save(user);

    this.logger.log(`Account activated for user: ${userId}`);
    return {
      message: 'Account activated successfully',
    };
  }

  /**
   * Format user response
   */
  private formatUserResponse(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      address: user.address,
      city: user.city,
      state: user.state,
      postal_code: user.postal_code,
      country: user.country,
      profile_picture_url: user.profile_picture_url,
      is_email_verified: user.is_email_verified,
      is_active: user.is_active,
      is_driver: user.is_driver,
      jazzcash_account_number: user.jazzcash_account_number,
      jazzcash_account_title: user.jazzcash_account_title,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
