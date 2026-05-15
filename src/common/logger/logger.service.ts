import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private logger = new Logger();

  /**
   * Get correlation ID from request context if available
   */
  setCorrelationId(correlationId: string): void {
    (global as any).__correlationId = correlationId;
  }

  private getCorrelationId(): string {
    try {
      if ((global as any).__correlationId) {
        return (global as any).__correlationId;
      }
    } catch (err) {
      // Fallback
    }
    return 'NO_CORRELATION_ID';
  }

  /**
   * Format log message with correlation ID and context
   */
  private formatMessage(message: string, context?: any): string {
    const correlationId = this.getCorrelationId();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${correlationId}] ${message}${contextStr}`;
  }

  /**
   * Log info level message
   */
  log(message: string, context?: any): void {
    this.logger.log(this.formatMessage(message, context));
  }

  /**
   * Log error level message
   */
  error(message: string, error?: any, context?: any): void {
    const errorObj = error instanceof Error ? error.message : error;
    this.logger.error(
      this.formatMessage(`${message} | Error: ${errorObj}`, context),
      error?.stack,
    );
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: any): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: any): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  /**
   * Log verbose level message
   */
  verbose(message: string, context?: any): void {
    this.logger.verbose(this.formatMessage(message, context));
  }
}
