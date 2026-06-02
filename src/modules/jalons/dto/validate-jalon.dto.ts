import { IsIn, IsOptional, IsString } from 'class-validator';

export class ValidateJalonDto {
  @IsIn(['VALIDATE', 'REJECT'])
  action: 'VALIDATE' | 'REJECT';

  @IsString()
  @IsOptional()
  proComment?: string;
}
