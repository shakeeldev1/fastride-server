import { Matches } from 'class-validator';

export class SetDriverCnicDto {
  @Matches(/^\d{13}$/, {
    message: 'CNIC must be exactly 13 digits, no dashes (e.g. 3520212345671)',
  })
  cnic!: string;
}
