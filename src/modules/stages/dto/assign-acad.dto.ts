import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignAcadDto {
  @IsUUID()
  @IsNotEmpty()
  encadrantAcadId: string;
}
