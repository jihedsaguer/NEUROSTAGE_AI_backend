import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignProDto {
  @IsUUID()
  @IsNotEmpty()
  encadrantProId: string;
}
