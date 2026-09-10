import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class RefundTopUpDto {
  /** Defaults to the full top-up amount when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;
}
