import { PartialType } from '@nestjs/mapped-types';
import { CreateProfileDto } from './create-profile.dto';

/**
 * All fields are optional — inherits validation rules from CreateProfileDto.
 */
export class UpdateProfileDto extends PartialType(CreateProfileDto) {}
