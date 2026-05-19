import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and numeric characters',
  })
  new_password!: string;

  @IsString()
  @MinLength(8, { message: 'Confirm password must be at least 8 characters' })
  confirm_password!: string;
}
