import { Controller, Get, Post, Delete, Put, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get('catalog/prices')
  async getPrices(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.storesService.getPriceMemory(req.user.uid);
  }

  @Post('catalog/prices')
  async savePrices(@Req() req: RequestWithUser, @Body('catalog') catalog: any) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.storesService.savePriceMemory(req.user.uid, catalog);
  }

  @Get(':id/catalog')
  async getCatalog(@Param('id') id: string, @Req() req: RequestWithUser) {
    const catalog = await this.storesService.getCatalog(id);
    // Si no es la tienda propietaria ni un ADMIN, ocultar campos de precio confidencial
    if (req.user.uid !== id && req.user.role !== 'ADMIN') {
      return catalog.map(({ price, cost, storeBaseUnitPrice, ...pub }) => pub);
    }
    return catalog;
  }

  @Get(':id/families')
  async getFamilies(@Param('id') id: string) {
    return this.storesService.getFamilies(id);
  }

  @Put(':id/families')
  async saveFamilies(
    @Param('id') storeId: string,
    @Req() req: RequestWithUser,
    @Body('families') families: string[],
  ) {
    if (req.user.uid !== storeId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para modificar las familias de esta tienda');
    }
    return this.storesService.saveFamilies(storeId, families || []);
  }

  @Post(':id/catalog')
  async upsertProducts(
    @Param('id') storeId: string,
    @Req() req: RequestWithUser,
    @Body('products') products: any[],
  ) {
    if (req.user.uid !== storeId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para modificar el catálogo de esta tienda');
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      return { upserted: 0 };
    }
    return this.storesService.upsertProducts(storeId, products);
  }

  @Delete(':id/catalog/:sku')
  async deleteProduct(
    @Param('id') storeId: string,
    @Param('sku') sku: string,
    @Req() req: RequestWithUser
  ) {
    if (req.user.uid !== storeId && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('No tienes permiso para modificar el catálogo de esta tienda');
    }
    await this.storesService.deleteProduct(storeId, sku);
    return { success: true, message: 'Producto eliminado' };
  }

  @Put('profile')
  async updateProfile(@Req() req: RequestWithUser, @Body() profileData: any) {
    if (req.user.role !== 'STORE') {
      throw new ForbiddenException('Solo las cuentas de tipo ferretería pueden actualizar este perfil');
    }
    return this.storesService.updateStoreProfile(req.user.uid, profileData);
  }
}

