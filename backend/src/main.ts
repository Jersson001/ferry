import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Aumentar límite del body para imágenes en base64 pequeñas (AI)
    bodyParser: true,
  });

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Aumentar límite del body parser para peticiones JSON (base64 de imágenes pequeñas para IA)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').json({ limit: '10mb' }));
  expressApp.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  // Servir archivos estáticos subidos (fotos de perfil, portafolio, catálogo)
  const uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'uploads');
  expressApp.use('/uploads', require('express').static(uploadsPath));

  // Activar validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Ferry backend corriendo en http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📁 Archivos estáticos sirviendo desde: ${uploadsPath}`);
}
bootstrap();
