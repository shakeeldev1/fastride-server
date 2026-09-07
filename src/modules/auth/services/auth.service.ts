import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import ms from 'ms';
import { User } from '../../user/entities/user.entity';
import { SignupDto } from '../dto/signup.dto';
import { LoginDto } from '../dto/login.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { VerifyForgotPasswordOtpDto } from '../dto/verify-forgot-password-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-refresh-secret-key';

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
   * Issue a new access + refresh token pair for a user, persisting a hash of
   * the refresh token (not the raw value) so it can be verified and revoked
   * later without storing a usable credential in the database.
   */
  private async issueTokens(user: User) {
    const payload = { id: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: crypto.randomUUID() },
      { secret: REFRESH_TOKEN_SECRET, expiresIn: REFRESH_TOKEN_EXPIRES_IN as ms.StringValue },
    );

    user.refresh_token = await bcrypt.hash(refreshToken, 10);
    user.refresh_token_expires_at = new Date(
      Date.now() + ms(REFRESH_TOKEN_EXPIRES_IN as ms.StringValue),
    );
    await this.userRepository.save(user);

    return { accessToken, refreshToken };
  }

  /**
   * Sign up a new user
   */
  async signup(signupDto: SignupDto) {
    const { email, phone, password, name, gender } = signupDto;

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
      gender,
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

    // Generate JWT access + refresh tokens on successful verification
    const { accessToken, refreshToken } = await this.issueTokens(user);

    return {
      message: 'Email verified successfully',
      token: accessToken,
      refresh_token: refreshToken,
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

    // Generate JWT access + refresh tokens
    const { accessToken, refreshToken } = await this.issueTokens(user);

    return {
      message: 'Logged in successfully',
      token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profile_picture_url: user.profile_picture_url,
        is_admin: user.is_admin,
        is_driver: user.is_driver,
        is_active: user.is_active,
        gender: user.gender,
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
   * Initiate forgot password flow: generate OTP, save, email it
   */
  async forgotPassword(forgotDto: ForgotPasswordDto) {
    const { email } = forgotDto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = this.generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.reset_password_token = otp;
    user.reset_password_expires_at = expires;

    await this.userRepository.save(user);

    // Send OTP email
    await this.emailService.sendPasswordResetOtpEmail(email, otp, user.name);

    return {
      message: 'OTP sent to your email',
    };
  }

  /**
   * Confirm the forgot-password OTP. On success, swaps it out for a
   * short-lived opaque reset token — resetPassword() below still consumes
   * that token, not the OTP itself, so the OTP can't be replayed/brute-forced
   * against the final step once it's been used.
   */
  async verifyForgotPasswordOtp(dto: VerifyForgotPasswordOtpDto) {
    const { email, otp } = dto;

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.reset_password_token || user.reset_password_token !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!user.reset_password_expires_at || new Date() > user.reset_password_expires_at) {
      throw new BadRequestException('OTP has expired');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.reset_password_token = resetToken;
    user.reset_password_expires_at = expires;

    await this.userRepository.save(user);

    return {
      message: 'OTP verified',
      resetToken,
    };
  }

  /**
   * Complete password reset using the token issued by verifyForgotPasswordOtp
   */
  async resetPassword(resetDto: ResetPasswordDto) {
    const { token, new_password, confirm_password } = resetDto;

    if (new_password !== confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepository.findOne({ where: { reset_password_token: token } });

    if (!user) {
      throw new NotFoundException('Invalid or expired token');
    }

    if (!user.reset_password_expires_at || new Date() > user.reset_password_expires_at) {
      throw new BadRequestException('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    user.password = hashedPassword;
    user.reset_password_token = null as unknown as string;
    user.reset_password_expires_at = null as unknown as Date;

    await this.userRepository.save(user);

    return {
      message: 'Password has been reset successfully',
    };
  }

  /**
   * Exchange a valid, unrevoked refresh token for a new access + refresh
   * token pair. The old refresh token is rotated out (its hash overwritten)
   * so it cannot be reused once a new one has been issued.
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refresh_token } = refreshTokenDto;

    let payload: { id: string };
    try {
      payload = await this.jwtService.verifyAsync(refresh_token, {
        secret: REFRESH_TOKEN_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.id } });

    if (!user || !user.refresh_token || !user.refresh_token_expires_at) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (new Date() > user.refresh_token_expires_at) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const isTokenValid = await bcrypt.compare(refresh_token, user.refresh_token);

    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(user);

    return {
      message: 'Token refreshed successfully',
      token: accessToken,
      refresh_token: newRefreshToken,
    };
  }

  /**
   * Revoke the stored refresh token so it can no longer be used to mint new
   * access tokens.
   */
  async logout(userId: string) {
    await this.userRepository.update(userId, {
      refresh_token: null,
      refresh_token_expires_at: null,
    });

    return {
      message: 'Logged out successfully',
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
      gender: user.gender,
      created_at: user.created_at,
    };
  }
}
