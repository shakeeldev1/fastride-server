import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetDriverPaymentMethodDto {
  @IsString({ message: 'JazzCash account number must be a string' })
  @MinLength(4, { message: 'JazzCash account number is too short' })
  @MaxLength(20, { message: 'JazzCash account number is too long' })
  jazzcashAccountNumber!: string;

  @IsString({ message: 'JazzCash account title must be a string' })
  @MinLength(2, { message: 'JazzCash account title is too short' })
  @MaxLength(100, { message: 'JazzCash account title is too long' })
  jazzcashAccountTitle!: string;
}
