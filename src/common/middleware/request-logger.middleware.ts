import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Generate unique correlation ID for this request
    const correlationId = uuidv4();
    (req as any).correlationId = correlationId;
    
    // Set correlation ID in logger
    this.logger.setCorrelationId(correlationId);

    const start = Date.now();
    const { method, url } = req;
    const userAgent = req.get('user-agent') || 'unknown';

    // Log incoming request
    this.logger.log(`[INCOMING] ${method} ${url}`, {
      userAgent,
      userId: (req as any).user?.id || 'anonymous',
    });

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      this.logger.log(`[OUTGOING] ${method} ${url} ${statusCode} ${duration}ms`, {
        userId: (req as any).user?.id || 'anonymous',
      });
    });

    next();
  }
}
