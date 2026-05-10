import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: true, // Permite cualquier origen que haga la petición
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
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
