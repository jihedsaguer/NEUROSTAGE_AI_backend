import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { IsValidEmailDomain } from './email-domain.validator';

class TestDto {
  @IsValidEmailDomain()
  email: string;
}

describe('IsValidEmailDomain Validator', () => {
  let dto: TestDto;

  beforeEach(() => {
    dto = new TestDto();
  });

  it('should accept sotetel.tn domain', async () => {
    dto.email = 'user@sotetel.tn';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept gmail.com domain', async () => {
    dto.email = 'user@gmail.com';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept aol.com domain', async () => {
    dto.email = 'user@aol.com';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept aol.fr domain', async () => {
    dto.email = 'user@aol.fr';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept outlook.fr domain', async () => {
    dto.email = 'user@outlook.fr';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept hotmail.com domain', async () => {
    dto.email = 'user@hotmail.com';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept hotmail.fr domain', async () => {
    dto.email = 'user@hotmail.fr';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject yahoo.com domain', async () => {
    dto.email = 'user@yahoo.com';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toBeDefined();
  });

  it('should reject invalid email', async () => {
    dto.email = 'invalid-email';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should be case insensitive', async () => {
    dto.email = 'User@SOTETEL.TN';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
