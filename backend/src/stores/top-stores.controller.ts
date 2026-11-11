import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { StoresService } from './stores.service';
import { esIdValido } from './catalogo-publico';
import { leerUbicacion, leerRadioKm } from '../quotes/ubicacion';

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

  @Get('promotions')
  @Header('Cache-Control', 'public, max-age=60')
  async getPromotions(@Query('limit') limit?: string) {
    const cantidad = Math.min(Math.max(parseInt(limit ?? '', 10) || 30, 1), 100);
    return this.storesService.getPromociones(cantidad);
  }

  @Get(':id/reviews')
  @Header('Cache-Control', 'public, max-age=30')
  async getReviews(@Param('id') id: string, @Query('limit') limit?: string) {
    if (!esIdValido(id)) throw new NotFoundException('Ferretería no encontrada');
    const cantidad = Math.min(Math.max(parseInt(limit ?? '', 10) || 10, 1), 50);
    return this.storesService.getOpiniones(id, cantidad);
  }

  @Get(':id/public-catalog')
  @Header('Cache-Control', 'public, max-age=30')
  async getPublicCatalog(@Param('id') id: string) {
    return this.storesService.getCatalogoPublico(id);
  }

  // Cuántas ferreterías cubren una obra: alimenta el deslizador de rango del cliente.
  @Get('coverage')
  @Header('Cache-Control', 'public, max-age=30')
  async getCoverage(@Query('category') category?: string, @Query('lat') lat?: string, @Query('lng') lng?: string, @Query('radioKm') radioKm?: string) {
    const obra = leerUbicacion({ userLat: lat, userLng: lng });
    return { count: await this.storesService.contarCobertura(String(category ?? ''), obra, leerRadioKm(radioKm)) };
  }
}
