import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiateJazzCashPaymentDto {
  @IsUUID('4', { message: 'rideRequestId must be a valid UUID' })
  rideRequestId!: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(100, { message: 'description must not exceed 100 characters' })
  description?: string;
}
