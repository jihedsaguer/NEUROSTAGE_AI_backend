import { IsEnum, IsNotEmpty } from 'class-validator';
import { SubjectStatus } from '../entities/subject.entity';

export class ValidateSubjectDto {
  @IsEnum(SubjectStatus)
  @IsNotEmpty()
  status: SubjectStatus.VALIDATED | SubjectStatus.REJECTED;
}
