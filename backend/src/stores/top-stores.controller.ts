import { Controller, Get, Header, Query } from '@nestjs/common';
import { StoresService } from './stores.service';
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

  // Cuántas ferreterías cubren una obra: alimenta el deslizador de rango del cliente.
  @Get('coverage')
  @Header('Cache-Control', 'public, max-age=30')
  async getCoverage(@Query('category') category?: string, @Query('lat') lat?: string, @Query('lng') lng?: string, @Query('radioKm') radioKm?: string) {
    const obra = leerUbicacion({ userLat: lat, userLng: lng });
    return { count: await this.storesService.contarCobertura(String(category ?? ''), obra, leerRadioKm(radioKm)) };
  }
}
