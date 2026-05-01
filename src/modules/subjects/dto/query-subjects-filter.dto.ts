import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubjectStatus } from '../entities/subject.entity';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  CREATED_AT = 'createdAt',
  TITLE = 'title',
}

export class QuerySubjectsFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Type(() => String)
  technologies?: string[];

  @IsString()
  @IsOptional()
  level?: string;

  @IsArray()
  @IsEnum(SubjectStatus, { each: true })
  @IsOptional()
  @Type(() => String)
  status?: SubjectStatus[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsEnum(SortField)
  @IsOptional()
  sortBy?: SortField = SortField.CREATED_AT;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;
}
