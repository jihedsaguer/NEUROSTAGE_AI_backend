import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

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
