import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDriverRegistrationDto {
  @IsString({ message: 'First name must be a string' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  firstName!: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  lastName!: string;

  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  dateOfBirth!: string;

  @IsString({ message: 'License number must be a string' })
  @MinLength(3, { message: 'License number must be at least 3 characters' })
  licenseNumber!: string;

  @IsDateString({}, { message: 'Expiration date must be a valid date' })
  expirationDate!: string;

  @IsString({ message: 'ID number must be a string' })
  @MinLength(3, { message: 'ID number must be at least 3 characters' })
  idNumber!: string;

  @IsString({ message: 'Vehicle brand must be a string' })
  @MinLength(2, { message: 'Vehicle brand must be at least 2 characters' })
  vehicleBrand!: string;

  @IsString({ message: 'Vehicle model must be a string' })
  @MinLength(2, { message: 'Vehicle model must be at least 2 characters' })
  vehicleModel!: string;

  @IsString({ message: 'Vehicle color must be a string' })
  @MinLength(2, { message: 'Vehicle color must be at least 2 characters' })
  vehicleColor!: string;

  @IsString({ message: 'Number plate must be a string' })
  @MinLength(3, { message: 'Number plate must be at least 3 characters' })
  numberPlate!: string;

  @Type(() => Number)
  @IsInt({ message: 'Production year must be an integer' })
  @Min(1900, { message: 'Production year must be 1900 or later' })
  productionYear!: number;
}