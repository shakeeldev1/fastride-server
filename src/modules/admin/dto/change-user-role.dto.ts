import { IsBoolean, IsOptional } from 'class-validator';

export class ChangeUserRoleDto {
  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;

  @IsOptional()
  @IsBoolean()
  is_driver?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
