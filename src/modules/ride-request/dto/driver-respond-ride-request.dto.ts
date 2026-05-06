import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DriverRespondRideRequestDto {
  @IsString({ message: 'Decision must be a string' })
  @IsIn(['interested', 'declined'], {
    message: 'Decision must be either interested or declined',
  })
  decision!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Counter offer price must be a number' })
  @Min(1, { message: 'Counter offer price must be greater than 0' })
  counterOfferPrice?: number;

  @IsOptional()
  @IsString({ message: 'Message must be a string' })
  @MaxLength(300, { message: 'Message must not exceed 300 characters' })
  message?: string;
}
