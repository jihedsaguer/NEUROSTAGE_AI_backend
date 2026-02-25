import { Expose, Type } from 'class-transformer';
import { RoleDto } from '../../roles/dto/role.dto';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  isActive: boolean;

  @Expose()
  @Type(() => RoleDto)
  roles: RoleDto[];
}