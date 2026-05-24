import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

  /**
   * Retorna todos los productos del catálogo de la tienda.
   * Mapea imageUrl → image para compatibilidad con el frontend.
   */
  async getCatalog(storeId: string): Promise<any[]> {
    const products = await this.catalogRepository.find({
      where: { storeId },
      order: { createdAt: 'DESC' },
    });
    return products.map(p => ({
      ...p,
      image: p.imageUrl || '',
    }));
  }

  /**
   * Retorna las familias persistidas del usuario (no calculadas desde productos).
   */
  async getFamilies(storeId: string): Promise<{ families: string[] }> {
    const user = await this.usersService.findOne(storeId);
    return { families: user?.families || [] };
  }

  /**
   * Guarda el arreglo de familias directamente en el registro del usuario.
   */
  async saveFamilies(storeId: string, families: string[]): Promise<{ families: string[] }> {
    const user = await this.usersService.findOne(storeId);
    if (!user) throw new NotFoundException('Ferretería no encontrada');
    await this.usersService.update(storeId, { families });
    return { families };
  }

  /**
   * Upsert real por storeId + sku (Versión Optimizada para Bulk)
   * En lugar de hacer N queries en paralelo, hace 1 query para buscar existentes
   * y 1 query masiva para guardar/actualizar todo.
   */
  async upsertProducts(storeId: string, products: any[]): Promise<{ upserted: number }> {
    if (!products.length) return { upserted: 0 };

    const skus = products.map(p => p.sku);
    
    // Buscar todos los productos existentes en un solo query
    const existingProducts = await this.catalogRepository.find({
      where: { storeId, sku: In(skus) },
    });

    const existingMap = new Map<string, CatalogProduct>();
    for (const p of existingProducts) {
      existingMap.set(p.sku, p);
    }

    const entitiesToSave: CatalogProduct[] = [];

    for (const productData of products) {
      const { image, ...rest } = productData;
      const payload = {
        ...rest,
        storeId,
        imageUrl: image || rest.imageUrl || '',
      };

      const existing = existingMap.get(productData.sku);
      if (existing) {
        // Actualizar la entidad en memoria
        Object.assign(existing, payload);
        entitiesToSave.push(existing);
      } else {
        // Crear nueva entidad
        const newProduct = this.catalogRepository.create(payload as unknown as Partial<CatalogProduct>);
        entitiesToSave.push(newProduct as CatalogProduct);
      }
    }

    // Guardar todo masivamente (TypeORM lo maneja por chunks automáticamente si es necesario)
    await this.catalogRepository.save(entitiesToSave, { chunk: 500 });

    return { upserted: products.length };
  }

  async deleteProduct(storeId: string, sku: string): Promise<void> {
    const product = await this.catalogRepository.findOne({ where: { storeId, sku } });
    if (!product) {
      throw new NotFoundException(`Producto con SKU ${sku} no encontrado en este catálogo`);
    }
    await this.catalogRepository.remove(product);
  }

  async updateStoreProfile(storeId: string, profileData: any): Promise<any> {
    // ── Whitelist de campos permitidos ────────────────────────────────────────
    // NUNCA se permiten: role, email, password, isEmailVerified, uid, etc.
    const ALLOWED_FIELDS = [
      'displayName', 'description', 'photoURL', 'phoneNumber',
      'location', 'specialties', 'rut', 'families', 'isProfileComplete',
    ];
    const safeData: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (profileData[key] !== undefined) {
        safeData[key] = profileData[key];
      }
    }
    if (Object.keys(safeData).length === 0) {
      return this.usersService.findOne(storeId);
    }
    return this.usersService.update(storeId, safeData);
  }
}

