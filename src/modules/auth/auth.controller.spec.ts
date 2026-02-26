import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({}),
            refreshToken: jest.fn().mockResolvedValue({}),
            logout: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call login on authService', async () => {
    const dto = { email: 'a', password: 'b' };
    await controller.login(dto as any);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('should call refresh on authService', async () => {
    await controller.refresh('rt');
    expect(authService.refreshToken).toHaveBeenCalledWith('rt');
  });

  it('should call logout on authService', async () => {
    await controller.logout('uid');
    expect(authService.logout).toHaveBeenCalledWith('uid');
  });
});
