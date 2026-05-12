export class ProfileResponseDto {
  id: string;
  phone?: string;
  university?: string;
  level?: string;
  graduationYear?: number;
  skills: string[];
  completionPercentage: number;
  isComplete: boolean;
  cinStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
