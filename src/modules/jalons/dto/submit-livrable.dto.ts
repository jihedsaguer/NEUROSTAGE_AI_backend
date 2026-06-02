import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SubmitLivrableDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;

  @IsInt()
  @Min(1)
  size: number;

  @IsString()
  @IsNotEmpty()
  hash: string;

  @IsString()
  @IsOptional()
  studentNote?: string;
}
