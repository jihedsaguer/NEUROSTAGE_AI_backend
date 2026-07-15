import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddParticipantDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
