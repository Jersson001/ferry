import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
}
