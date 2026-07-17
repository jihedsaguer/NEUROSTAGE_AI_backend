import { IsNotEmpty, IsEnum } from 'class-validator';

export enum DocumentType {
  CV = 'CV',
  TRANSCRIPT = 'TRANSCRIPT',
  CERTIFICATE = 'CERTIFICATE',
  CIN = 'CIN',
  OTHER = 'OTHER',
}

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  @IsNotEmpty()
  type: string;
}
