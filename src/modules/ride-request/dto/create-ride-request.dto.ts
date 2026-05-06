import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRideRequestDto {
  @IsOptional()
  @IsString({ message: 'Pickup area must be a string' })
  @MinLength(2, { message: 'Pickup area must be at least 2 characters' })
  @MaxLength(100, { message: 'Pickup area must not exceed 100 characters' })
  pickupArea!: string;

  @IsString({ message: 'Pickup location must be a string' })
  @MinLength(3, { message: 'Pickup location must be at least 3 characters' })
  @MaxLength(200, { message: 'Pickup location must not exceed 200 characters' })
  pickupLocation!: string;

  @IsString({ message: 'Dropoff location must be a string' })
  @MinLength(3, { message: 'Dropoff location must be at least 3 characters' })
  @MaxLength(200, { message: 'Dropoff location must not exceed 200 characters' })
  dropoffLocation!: string;

  @IsString({ message: 'Vehicle type must be a string' })
  @IsIn(['bike', 'car', 'auto', 'van'], {
    message: 'Vehicle type must be one of: bike, car, auto, van',
  })
  vehicleType!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Offered price must be a number' })
  @Min(1, { message: 'Offered price must be greater than 0' })
  offeredPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Pickup latitude must be a number' })
  pickupLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Pickup longitude must be a number' })
  pickupLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Dropoff latitude must be a number' })
  dropoffLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Dropoff longitude must be a number' })
  dropoffLongitude?: number;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes must not exceed 500 characters' })
  notes?: string;
}
