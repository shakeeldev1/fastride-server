import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class InitiateTopUpDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be greater than 0' })
  amount!: number;
}
