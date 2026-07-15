import { IsString, IsNotEmpty } from 'class-validator';

export class RagIngestDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsNotEmpty()
  documentName: string;

  @IsString()
  @IsNotEmpty()
  documentType: string;
}

export class RagQueryDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}
