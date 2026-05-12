import { IsUUID, IsNotEmpty, IsOptional, IsDateString, IsString, IsEmail } from 'class-validator';

export class CreateStageDto {
  // OLD METHOD: Provide candidatureId directly (admin knows the ID)
  @IsUUID()
  @IsOptional()
  candidatureId?: string;

  // NEW METHOD: Provide student email + subject identifier for admin-friendly creation
  @IsEmail()
  @IsOptional()
  studentEmail?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  subjectTitle?: string;

  // Encadrant Pro: can provide UUID or email
  @IsUUID()
  @IsOptional()
  encadrantProId?: string;

  @IsEmail()
  @IsOptional()
  encadrantProEmail?: string;

  // Encadrant Academic: can provide UUID or email (optional)
  @IsUUID()
  @IsOptional()
  encadrantAcadId?: string;

  @IsEmail()
  @IsOptional()
  encadrantAcadEmail?: string;

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

