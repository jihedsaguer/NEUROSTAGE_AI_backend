import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  university?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsNumber()
  @IsOptional()
  @Min(2000)
  @Max(2100)
  graduationYear?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsString()
  @IsOptional()
  cinLast3Digits?: string;

  @IsEnum(['PENDING', 'VERIFIED', 'REJECTED'])
  @IsOptional()
  cinStatus?: string;
}
