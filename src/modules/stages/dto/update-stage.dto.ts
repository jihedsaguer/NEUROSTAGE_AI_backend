import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { StageStatus } from '../entities/stage.entity';

export class UpdateStageDto {
  @IsEnum(StageStatus)
  @IsOptional()
  status?: StageStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  adminNotes?: string;
}
