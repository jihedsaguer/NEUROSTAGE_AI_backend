import { JalonStatus } from '../entities/jalon.entity';

export class UserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class LivrableResponseDto {
  id: string;
  jalonId: string;
  studentId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
  scanOk: boolean;
  studentNote: string | null;
  submittedAt: Date;
  // hash is intentionally excluded
}

export class JalonResponseDto {
  id: string;
  stageId: string;
  label: string;
  description: string | null;
  dueDate: Date;
  order: number;
  status: JalonStatus;
  validatedBy: UserSummaryDto | null;
  validatedAt: Date | null;
  proComment: string | null;
  acadComment: string | null;
  livrable: LivrableResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
}
