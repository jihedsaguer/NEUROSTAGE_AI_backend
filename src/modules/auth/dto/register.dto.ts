import { IsEmail, IsNotEmpty } from 'class-validator';
import { IsValidEmailDomain } from '../../../common/validators/email-domain.validator';
import { IsStrongPassword } from '../../../common/validators/password-strength.validator';

export class RegisterDto {
  @IsEmail()
  @IsValidEmailDomain()
  email: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsStrongPassword()
  password: string;
}