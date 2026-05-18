import { Controller, Post, Get, Query, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../storage/storage.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * POST /catalog/upload-image
   * Recibe una imagen codificada en Base64, la comprime a WebP y devuelve la URL pública.
   * Llamado desde CatalogManager.tsx al seleccionar un archivo desde disco.
   */
  @Post('upload-image')
  async uploadImage(
    @Req() req: RequestWithUser,
    @Body('base64') base64: string,
  ): Promise<{ url: string }> {
    if (!base64) {
      throw new BadRequestException('Se requiere el campo "base64".');
    }
    try {
      const url = await this.storageService.saveBase64Image(base64, req.user.uid, 'catalog');
      return { url };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Error al procesar la imagen.');
    }
  }

  /**
   * GET /catalog/proxy-sheets?url=...
   * Descarga el CSV desde Google Sheets en el backend para evitar bloqueos por CORS en el frontend.
   */
  @Get('proxy-sheets')
  async proxySheets(@Query('url') targetUrl: string): Promise<string> {
    if (!targetUrl) {
      throw new BadRequestException('Falta el parámetro url');
    }
    try {
      // Usar fetch nativo de Node.js (disponible en Node 18+)
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new BadRequestException('No se pudo descargar la hoja. Asegúrate de que el enlace sea público.');
      }
      return await response.text();
    } catch (err: any) {
      throw new BadRequestException('Error al conectar con Google Sheets: ' + err.message);
    }
  }
}
