// assignment-response.dto.ts
import { Expose, Type } from 'class-transformer';
import { EncadreurDto } from './encadreur.dto';
import { StudentDto } from './student.dto';

export class AssignmentResponseDto {
  @Expose() id: string;

  @Expose()
  @Type(() => EncadreurDto)
  encadreur: EncadreurDto;

  @Expose()
  @Type(() => StudentDto)
  student: StudentDto;
}
