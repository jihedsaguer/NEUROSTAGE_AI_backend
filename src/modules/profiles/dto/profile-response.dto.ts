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
  cinLast3Digits?: string;
  /** Foundation field for future AI CV processing integration */
  isAiProcessed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
