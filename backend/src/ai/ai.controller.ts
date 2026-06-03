import { Controller, Post, Body, UseGuards, BadRequestException, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AiService } from './ai.service';
import { StoresService } from '../stores/stores.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

interface RequestWithUser extends Request {
  user: any;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly storesService: StoresService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('parse-materials')
  async parseMaterials(@Body('text') text: string) {
    if (!text || text.trim() === '') {
      throw new BadRequestException('El texto de entrada no puede estar vacío');
    }
    
    // Llamamos al servicio de IA
    const items = await this.aiService.parseMaterialsList(text);
    return { items };
  }

  @Post('analyze-image')
  async analyzeImage(@Body('base64Image') base64Image: string) {
    if (!base64Image || base64Image.trim() === '') {
      throw new BadRequestException('La imagen no puede estar vacía');
    }
    const items = await this.aiService.analyzeImage(base64Image);
    return { items };
  }

  @Post('smart-match')
  async smartMatch(@Body('requestedItems') requestedItems: any[], @Req() req: RequestWithUser) {
    if (!requestedItems || !Array.isArray(requestedItems) || requestedItems.length === 0) {
      throw new BadRequestException('requestedItems debe ser un array no vacío');
    }

    const storeId = req.user.uid;
    if (req.user.role !== 'STORE') {
      throw new ForbiddenException('Solo las ferreterías pueden usar Smart Match');
    }

    // 1. Obtener el catálogo completo de la tienda
    const catalog = await this.storesService.getCatalog(storeId);
    if (catalog.length === 0) {
      throw new BadRequestException('No tienes productos en tu catálogo para emparejar');
    }

    // 2. Ejecutar la IA primero (si falla, no se descuenta nada)
    const result = await this.aiService.smartMatch(requestedItems, catalog);
      
    // 3. Descontar el crédito (Lanzará error 400 si no hay créditos suficientes)
    // Nota: Si no hay saldo, la IA procesó pero no entregamos el resultado.
    // Esto previene que se queden sin saldo por errores de Google.
    await this.subscriptionsService.deductCredits(storeId, 1, 'AI-SMART-MATCH');
      
    return result;
  }
}
