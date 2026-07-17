import { Test, TestingModule } from '@nestjs/testing';
import { RequestLoggerMiddleware } from './request-logger.middleware';
import { LoggerService } from '../logger/logger.service';
import { Request, Response, NextFunction } from 'express';

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestLoggerMiddleware, LoggerService],
    }).compile();

    middleware = module.get<RequestLoggerMiddleware>(RequestLoggerMiddleware);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should attach correlation ID to request', () => {
    const loggerSpy = jest.spyOn(loggerService, 'log');
    
    const mockRequest = {
      method: 'GET',
      url: '/test',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    } as unknown as Request;

    const mockResponse = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    middleware.use(mockRequest, mockResponse, next);

    expect((mockRequest as any).correlationId).toBeDefined();
    expect(loggerSpy).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should log incoming and outgoing requests', () => {
    const loggerSpy = jest.spyOn(loggerService, 'log');

    const mockRequest = {
      method: 'POST',
      url: '/subjects',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: { id: 'user-123' },
    } as unknown as Request;

    const mockResponse = {
      statusCode: 201,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    middleware.use(mockRequest, mockResponse, next);

    expect(loggerSpy).toHaveBeenCalledTimes(2); // incoming + outgoing
    expect(loggerSpy.mock.calls[0][0]).toContain('[INCOMING]');
    expect(loggerSpy.mock.calls[1][0]).toContain('[OUTGOING]');
  });

  it('should include user ID in logs if available', () => {
    const loggerSpy = jest.spyOn(loggerService, 'log');

    const mockRequest = {
      method: 'GET',
      url: '/subjects',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: { id: 'user-456' },
    } as unknown as Request;

    const mockResponse = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          callback();
        }
      }),
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    middleware.use(mockRequest, mockResponse, next);

    expect(loggerSpy).toHaveBeenCalled();
  });
});
