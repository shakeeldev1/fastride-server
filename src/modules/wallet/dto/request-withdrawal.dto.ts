import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class RequestWithdrawalDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @Min(1, { message: 'amount must be greater than 0' })
  amount!: number;
}
