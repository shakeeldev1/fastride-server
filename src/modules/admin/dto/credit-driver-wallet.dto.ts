import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreditDriverWalletDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
