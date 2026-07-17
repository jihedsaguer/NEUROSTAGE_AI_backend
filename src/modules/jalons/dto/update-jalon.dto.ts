import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateJalonDto } from './create-jalon.dto';

export class UpdateJalonDto extends PartialType(
  OmitType(CreateJalonDto, ['stageId'] as const),
) {}
