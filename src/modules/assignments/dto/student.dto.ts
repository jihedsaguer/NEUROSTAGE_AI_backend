import { Expose, Type } from 'class-transformer';
import { RoleDto } from '../../roles/dto/role.dto';

export class StudentDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  @Type(() => RoleDto)   // ensures roles are transformed properly
  roles: RoleDto[];
}
