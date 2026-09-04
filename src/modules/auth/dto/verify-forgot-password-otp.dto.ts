import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyForgotPasswordOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email!: string;

  @IsString({ message: 'OTP must be a string' })
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp!: string;
}
