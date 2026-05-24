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

    // ── Protección SSRF: solo se permiten URLs de Google Sheets/Docs ──────────
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      throw new BadRequestException('La URL proporcionada no es válida.');
    }

    const ALLOWED_HOSTNAMES = [
      'docs.google.com',
      'spreadsheets.google.com',
      'drive.google.com',
    ];
    if (!ALLOWED_HOSTNAMES.includes(parsedUrl.hostname)) {
      throw new BadRequestException(
        'Solo se permiten URLs de Google Sheets. Asegúrate de compartir el enlace público del archivo.',
      );
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new BadRequestException('No se pudo descargar la hoja. Asegúrate de que el enlace sea público.');
      }
      return await response.text();
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Error al conectar con Google Sheets: ' + err.message);
    }
  }
}
