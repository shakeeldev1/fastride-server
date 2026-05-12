import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../user/entities/user.entity';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a random 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Sign up a new user
   */
  async signup(signupDto: SignupDto) {
    const { email, phone, password, name } = signupDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { phone }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or phone number already exists',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = this.generateOTP();
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = this.userRepository.create({
      name,
      email,
      phone,
      password: hashedPassword,
      otp,
      otp_expires_at,
      is_email_verified: false,
      is_active: true,
    });

    await this.userRepository.save(user);

    // Send OTP email
    await this.emailService.sendOtpEmail(email, otp, name);

    return {
      message: 'User registered successfully. Please verify your email with the OTP sent.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email already verified');
    }

    if (user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > user.otp_expires_at) {
      throw new BadRequestException('OTP has expired');
    }

    // Verify email
    user.is_email_verified = true;
    user.otp = null as unknown as string;
    user.otp_expires_at = null as unknown as Date;

    await this.userRepository.save(user);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    };
  }

  /**
   * Resend OTP
   */
  async resendOtp(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.is_email_verified) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new OTP
    const otp = this.generateOTP();
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otp_expires_at = otp_expires_at;

    await this.userRepository.save(user);

    // Send OTP email
    await this.emailService.sendOtpEmail(email, otp, user.name);

    return {
      message: 'OTP resent successfully',
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_email_verified) {
      throw new BadRequestException('Please verify your email before logging in');
    }

    if (!user.is_active) {
      throw new BadRequestException('Your account has been deactivated');
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
    });

    console.log('✅ JWT Token Generated');
    console.log('📋 JWT_SECRET used for signing:', process.env.JWT_SECRET);
    console.log('🔑 Token payload:', { id: user.id, email: user.email });
    console.log('🎫 Generated token:', token.substring(0, 50) + '...');

    return {
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profile_picture_url: user.profile_picture_url,
        is_admin: user.is_admin,
        is_driver: user.is_driver,
        is_active: user.is_active,
      },
    };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { old_password, new_password, confirm_password } = changePasswordDto;

    if (new_password !== confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(old_password, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    user.password = hashedPassword;
    await this.userRepository.save(user);

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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
      is_admin: user.is_admin,
      is_driver: user.is_driver,
      created_at: user.created_at,
    };
  }
}
