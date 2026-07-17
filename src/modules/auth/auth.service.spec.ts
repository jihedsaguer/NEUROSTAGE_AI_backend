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
  let userRepo: Repository<User>;

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
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
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
      jest
        .spyOn(service as any, 'setRefreshToken')
        .mockResolvedValue('refresh-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password',
      });

      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toEqual('signed-token');
      expect(result.refreshToken).toEqual('refresh-token');
      expect(result.user.email).toEqual(fakeUser.email);
      expect(result.user.roles).toHaveLength(1);
    });

    it('should issue new tokens when refreshing', async () => {
      const fakeUser: any = {
        id: 'uuid-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        roles: [
          { name: 'student', permissions: [{ action: 'read' }] },
        ],
        refreshToken: 'old-token',
        refreshTokenExpires: new Date(Date.now() + 10000),
      };

      jest.spyOn(userRepo, 'findOne' as any).mockResolvedValue(fakeUser);
      jest.spyOn(service as any, 'setRefreshToken').mockResolvedValue('new-refresh');

      const res = await service.refreshToken('old-token');
      expect(res.accessToken).toEqual('signed-token');
      expect(res.refreshToken).toEqual('new-refresh');
    });
  });
});
