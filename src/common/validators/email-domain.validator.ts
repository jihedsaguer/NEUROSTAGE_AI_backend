import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidEmailDomain', async: false })
export class IsValidEmailDomainConstraint implements ValidatorConstraintInterface {
  private allowedDomains = [
    'sotetel.tn',
    'gmail.com',
    'aol.com',
    'aol.fr',
    'outlook.fr',
    'hotmail.com',
    'hotmail.fr',
    'esprit.tn',
  ];

  validate(email: string): boolean {
    if (!email || typeof email !== 'string') { 
      return false;
    }

    const parts = email.split('@');
    if (parts.length !== 2) {
      return false;
    }

    const domain = parts[1].toLowerCase();
    return this.allowedDomains.includes(domain);
  }

  defaultMessage(): string {
    return 'Email domain not allowed. Allowed domains: @sotetel.tn, @gmail.com, @aol.com, @aol.fr, @outlook.fr, @hotmail.com, @hotmail.fr';
  }
}

export function IsValidEmailDomain(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidEmailDomainConstraint,
    });
  };
}
