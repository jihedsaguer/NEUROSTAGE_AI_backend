import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transform } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // global validation pipe to imporve data security 
  app.useGlobalPipes(
    new ValidationPipe({ 
      whitelist: true,
       forbidNonWhitelisted: true, 
       transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
