import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-token') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return auth response with token and user dto', async () => {
      const fakeUser: any = {
        id: 'uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        roles: [
          { name: 'student', permissions: [{ action: 'read' }] },
        ],
      };

      jest
        .spyOn(service, 'validateUser')
        .mockResolvedValue(fakeUser as User);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toEqual('signed-token');
      expect(result.user.email).toEqual(fakeUser.email);
      expect(result.user.roles).toHaveLength(1);
    });
  });
});
