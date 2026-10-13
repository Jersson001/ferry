import { Controller, Get, Header, Query } from '@nestjs/common';
import { StoresService } from './stores.service';

// Público a propósito: la pantalla de inicio también la ven los invitados, y solo expone datos
// de la tienda (nombre, foto, especialidad, ubicación y calificación), nunca correo ni teléfono.
@Controller('stores')
export class TopStoresController {
  constructor(private storesService: StoresService) {}

  @Get('top-rated')
  @Header('Cache-Control', 'public, max-age=60')
  async getTopRated(@Query('limit') limit?: string) {
    const cantidad = Math.min(Math.max(parseInt(limit ?? '', 10) || 10, 1), 50);
    return this.storesService.getTopRatedStores(cantidad);
  }
}
