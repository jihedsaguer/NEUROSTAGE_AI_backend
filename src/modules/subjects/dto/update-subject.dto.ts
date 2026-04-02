import { IsString, IsArray, IsOptional, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  prerequisites?: string;
}
