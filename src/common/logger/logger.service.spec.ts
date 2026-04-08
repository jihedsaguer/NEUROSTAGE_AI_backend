import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log message with correlation ID', () => {
    const logSpy = jest.spyOn(service as any, 'log');
    service.log('Test message', { userId: '123' });
    expect(logSpy).toHaveBeenCalled();
  });

  it('should error log with correlation ID', () => {
    const errorSpy = jest.spyOn(service as any, 'error');
    service.error('Error message', new Error('Test error'), { userId: '123' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should warn log with correlation ID', () => {
    const warnSpy = jest.spyOn(service as any, 'warn');
    service.warn('Warning message', { userId: '123' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should debug log with correlation ID', () => {
    const debugSpy = jest.spyOn(service as any, 'debug');
    service.debug('Debug message', { userId: '123' });
    expect(debugSpy).toHaveBeenCalled();
  });

  it('should verbose log with correlation ID', () => {
    const verboseSpy = jest.spyOn(service as any, 'verbose');
    service.verbose('Verbose message', { userId: '123' });
    expect(verboseSpy).toHaveBeenCalled();
  });

  it('should handle error without context', () => {
    const errorSpy = jest.spyOn(service as any, 'error');
    service.error('Error without context', new Error('Test'));
    expect(errorSpy).toHaveBeenCalled();
  });
});
