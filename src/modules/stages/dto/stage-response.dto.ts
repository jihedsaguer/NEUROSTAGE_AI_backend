import { StageStatus } from '../entities/stage.entity';

export class StageUserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export class StageSubjectDto {
  id: string;
  title: string;
  level: string;
  technologies: string[];
}

export class StageResponseDto {
  id: string;
  status: StageStatus;
  student: StageUserDto;
  encadrantPro: StageUserDto;
  encadrantAcad: StageUserDto | null;
  subject: StageSubjectDto;
  candidatureId: string;
  startDate: Date | null;
  endDate: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
