import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from './entities/catalog-product.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(CatalogProduct)
    private catalogRepository: Repository<CatalogProduct>,
    private usersService: UsersService,
  ) {}

  async getPriceMemory(storeId: string): Promise<Record<string, any>> {
    const user = await this.usersService.findOne(storeId);
    return user?.priceMemory || {};
  }

  async savePriceMemory(storeId: string, catalog: Record<string, any>): Promise<void> {
    const user = await this.usersService.findOne(storeId);
    if (!user) throw new NotFoundException('Ferretería no encontrada');
    const updatedMemory = { ...user.priceMemory, ...catalog };
    await this.usersService.update(storeId, { priceMemory: updatedMemory });
  }

  async getCatalog(storeId: string): Promise<CatalogProduct[]> {
    return this.catalogRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getFamilies(storeId: string): Promise<string[]> {
    const products = await this.catalogRepository.find({
      where: { storeId },
      select: ['family'],
    });
    
    const families = products
      .map(p => p.family)
      .filter(f => f != null && f.trim() !== '') as string[];
      
    return [...new Set(families)]; // Retornar valores únicos
  }

  async addProduct(storeId: string, productData: Partial<CatalogProduct>): Promise<CatalogProduct> {
    const product = this.catalogRepository.create({
      ...productData,
      storeId,
    });
    return this.catalogRepository.save(product);
  }

  async deleteProduct(storeId: string, sku: string): Promise<void> {
    const product = await this.catalogRepository.findOne({ where: { storeId, sku } });
    if (!product) {
      throw new NotFoundException(`Producto con SKU ${sku} no encontrado en este catálogo`);
    }
    await this.catalogRepository.remove(product);
  }

  async updateStoreProfile(storeId: string, profileData: any): Promise<any> {
    // Reutilizamos el UsersService para actualizar el perfil, ya que la tienda es un User con rol STORE
    return this.usersService.update(storeId, profileData);
  }
}
