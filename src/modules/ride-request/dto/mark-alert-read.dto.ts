import { IsBoolean } from 'class-validator';

export class MarkAlertReadDto {
  @IsBoolean({ message: 'isRead must be a boolean value' })
  isRead!: boolean;
}
