import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Matches, Min } from 'class-validator';

export class InitiateTopUpDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be greater than 0' })
  amount!: number;

  /** 'mwallet' debits a JazzCash mobile account directly; 'card' redirects to JazzCash's hosted checkout. */
  @IsOptional()
  @IsIn(['mwallet', 'card'], { message: 'Method must be either mwallet or card' })
  method?: 'mwallet' | 'card';

  /** Required when method is 'mwallet' — the JazzCash-linked mobile account to debit (e.g. 03001234567). */
  @IsOptional()
  @Matches(/^03\d{9}$/, {
    message: 'Mobile number must be in local format, e.g. 03001234567',
  })
  mobileNumber?: string;
}
