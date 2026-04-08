import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { IsStrongPassword } from './password-strength.validator';

class TestDto {
  @IsStrongPassword()
  password: string;
}

describe('IsStrongPassword Validator', () => {
  let dto: TestDto;

  beforeEach(() => {
    dto = new TestDto();
  });

  it('should accept strong password', async () => {
    dto.password = 'StrongPass@123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept password with special char @', async () => {
    dto.password = 'MyPassword@456';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept password with special char $', async () => {
    dto.password = 'MyPassword$789';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept password with special char !', async () => {
    dto.password = 'MyPassword!101';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject password without uppercase', async () => {
    dto.password = 'mypassword@123';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject password without lowercase', async () => {
    dto.password = 'MYPASSWORD@123';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject password without number', async () => {
    dto.password = 'MyPassword@abc';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject password without special character', async () => {
    dto.password = 'MyPassword123';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject password shorter than 8 characters', async () => {
    dto.password = 'Pass@12';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty password', async () => {
    dto.password = '';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept password with exactly 8 characters if strong', async () => {
    dto.password = 'Abcd@123';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should accept longer password', async () => {
    dto.password = 'VeryLongPasswordWithSpecialChars@123456';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
