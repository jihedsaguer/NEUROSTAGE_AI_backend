import { IsNotEmpty, IsEmail } from 'class-validator';
import { IsValidEmailDomain } from '../../../common/validators/email-domain.validator';

export class LoginDto {
  @IsEmail()
  @IsValidEmailDomain()
  email: string;

  @IsNotEmpty()
  password: string;
}
