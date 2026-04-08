import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const correlationId = request?.correlationId || 'NO_CORRELATION_ID';
    this.logger.setCorrelationId(correlationId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: any = {};

    // Handle HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || {};
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = {
        name: exception.name,
        // Only include stack trace in development
        ...(process.env.NODE_ENV !== 'production' && {
          stack: exception.stack,
        }),
      };
    }

    // Log the exception
    this.logger.error(`[${request?.method}] ${request?.url} - ${status}`, exception, {
      userId: request?.user?.id,
    });

    // Send standardized response
    response.status(status).json({
      statusCode: status,
      message,
      error: process.env.NODE_ENV === 'production' ? {} : error,
      timestamp: new Date().toISOString(),
      path: request?.url,
      correlationId,
    });
  }
}
