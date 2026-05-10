import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el frontend (Vite dev + producción)
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:4173', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Activar validación global de DTOs (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Elimina campos no declarados en el DTO
      forbidNonWhitelisted: true, // Lanza error si llegan campos extra
      transform: true,          // Convierte tipos automáticamente
      errorHttpStatusCode: 400,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Ferry backend corriendo en http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
