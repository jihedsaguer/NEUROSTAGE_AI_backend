import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/exception.filter';
import { LoggerService } from './common/logger/logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get logger and exception filter
  const loggerService = app.get(LoggerService);
  const exceptionFilter = new AllExceptionsFilter(loggerService);

  // Helmet — HTTP security headers
  // contentSecurityPolicy disabled: CSP policy belongs in Nginx for this
  // deployment; enabling it here would require per-route tuning and can break
  // WebSocket / SSE upgrade headers. All other Helmet defaults are enabled.
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(exceptionFilter);

  // Serve uploaded files statically at /uploads
  // setHeaders ensures that even if a malicious .html/.svg file slips through,
  // the browser treats it as a download rather than executing it.
  try {
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const absolute = join(process.cwd(), uploadDir);
    (app as unknown as NestExpressApplication).useStaticAssets(absolute, {
      prefix: '/uploads',
      setHeaders: (res) => {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    });
    Logger.log(`Serving static uploads from ${absolute} at /uploads`);
  } catch (e) {
    Logger.warn(
      `Failed to enable static uploads serving: ${(e as Error).message}`,
    );
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  loggerService.log(`Application listening on port ${port} on 0.0.0.0`);
}

bootstrap();
