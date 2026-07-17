export class DocumentResponseDto {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  size: number;
  scanOk: boolean;
  createdAt: Date;
}
