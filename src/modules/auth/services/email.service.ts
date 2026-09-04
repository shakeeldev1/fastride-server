import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter!: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendOtpEmail(email: string, otp: string, userName: string): Promise<void> {
    try {
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #007bff;">Welcome to Indrive! 🚗</h2>
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Thank you for registering with Indrive. To complete your registration and verify your email, please use the OTP code below:</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <h1 style="letter-spacing: 5px; color: #007bff; margin: 0;">${otp}</h1>
              </div>

              <p><strong>Important:</strong> This OTP will expire in 10 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you did not request this code, please ignore this email.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2026 Indrive. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Indrive Email Verification - OTP Code',
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, (error as Error).message);
      throw new Error(`Email sending failed: ${(error as Error).message}`);
    }
  }

  async sendPasswordResetOtpEmail(email: string, otp: string, userName: string): Promise<void> {
    try {
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #007bff;">Password Reset Request 🔐</h2>
              <p>Hi <strong>${userName}</strong>,</p>
              <p>We received a request to reset your password. Use the OTP code below to confirm it's you:</p>

              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <h1 style="letter-spacing: 5px; color: #007bff; margin: 0;">${otp}</h1>
              </div>

              <p><strong>Important:</strong> This OTP will expire in 10 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email — your password will remain unchanged.</p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2026 Indrive. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `;

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Indrive Password Reset - OTP Code',
        html: htmlContent,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset OTP email to ${email}:`, (error as Error).message);
      throw new Error(`Email sending failed: ${(error as Error).message}`);
    }
  }

  async sendDriverRideAlertEmail(
    email: string,
    driverName: string,
    details: {
      pickupLocation: string;
      dropoffLocation: string;
      vehicleType: string;
      offeredPrice: number;
      rideRequestId: string;
    },
  ): Promise<void> {
    try {
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #007bff;">New Ride Request Available</h2>
              <p>Hi <strong>${driverName}</strong>,</p>
              <p>A rider is looking for a <strong>${details.vehicleType}</strong> ride.</p>

              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>From:</strong> ${details.pickupLocation}</p>
                <p><strong>To:</strong> ${details.dropoffLocation}</p>
                <p><strong>Offer:</strong> ${details.offeredPrice}</p>
                <p><strong>Request ID:</strong> ${details.rideRequestId}</p>
              </div>

              <p>Open your app to accept this ride request.</p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2026 Indrive. All rights reserved.
              </p>
            </div>
          </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Indrive - New Ride Request Alert',
        html: htmlContent,
      });

      this.logger.log(`Ride alert email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ride alert email to ${email}:`,
        (error as Error).message,
      );
      throw new Error(`Email sending failed: ${(error as Error).message}`);
    }
  }
}
