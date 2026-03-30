import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transform } from 'class-transformer';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  

 app.enableCors({
    origin: 'http://localhost:5173', // Replace with your Vite app's URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Enable cookies and authentication
  });
  
  app.useGlobalPipes(
    new ValidationPipe({ 
      whitelist: true,
       forbidNonWhitelisted: true, 
       transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
