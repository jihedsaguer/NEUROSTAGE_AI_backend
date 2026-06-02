import { IsNotEmpty, IsString } from 'class-validator';

export class AcadCommentDto {
  @IsString()
  @IsNotEmpty()
  acadComment: string;
}
