import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from './exception.filter';
import { LoggerService } from '../logger/logger.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter, LoggerService],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException', () => {
    const loggerSpy = jest.spyOn(loggerService, 'error');
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockRequest = {
      url: '/test',
      method: 'GET',
      user: { id: 'user-123' },
      correlationId: 'corr-123',
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    const httpException = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    filter.catch(httpException, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should handle Error exception', () => {
    const loggerSpy = jest.spyOn(loggerService, 'error');
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockRequest = {
      url: '/test',
      method: 'POST',
      user: { id: 'user-456' },
      correlationId: 'corr-456',
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    const error = new Error('Something went wrong');
    filter.catch(error, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should include correlation ID in response', () => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const mockRequest = {
      url: '/test',
      method: 'GET',
      correlationId: 'test-corr-id-789',
    };

    const mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(new Error('Test'), mockArgumentsHost);

    const jsonCall = mockResponse.json.mock.calls[0][0];
    expect(jsonCall.correlationId).toBe('test-corr-id-789');
  });
});
