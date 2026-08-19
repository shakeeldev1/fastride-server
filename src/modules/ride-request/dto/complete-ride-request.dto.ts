import { IsIn, IsString } from 'class-validator';

export class CompleteRideRequestDto {
  @IsString({ message: 'paymentMethod must be a string' })
  @IsIn(['online', 'cash'], { message: 'paymentMethod must be one of: online, cash' })
  paymentMethod!: string;
}
