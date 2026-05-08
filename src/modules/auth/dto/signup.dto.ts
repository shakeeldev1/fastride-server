import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @IsEmail({}, { message: 'Please provide a valid email' })
  email!: string;

  @IsString({ message: 'Phone must be a string' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { 
    message: 'Please provide a valid international phone number (E.164 format)' 
  })
  phone!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
