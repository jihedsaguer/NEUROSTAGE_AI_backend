import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/exception.filter';
import { LoggerService } from './common/logger/logger.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get logger and exception filter
  const loggerService = app.get(LoggerService);
  const exceptionFilter = new AllExceptionsFilter(loggerService);

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
  try {
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const absolute = join(process.cwd(), uploadDir);
    (app as unknown as NestExpressApplication).useStaticAssets(absolute, {
      prefix: '/uploads',
    });
    Logger.log(`Serving static uploads from ${absolute} at /uploads`);
  } catch (e) {
    Logger.warn(`Failed to enable static uploads serving: ${(e as Error).message}`);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  loggerService.log(`Application listening on port ${port} on 0.0.0.0`);
}

bootstrap();

