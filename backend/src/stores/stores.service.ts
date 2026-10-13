import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { CatalogProduct } from './entities/catalog-product.entity';
import { UsersService } from '../users/users.service';
import { sanitizarPerfil, perfilPropio } from '../users/perfil';
import { Quote } from '../quotes/entities/quote.entity';
import { contarTiendasQueCubren } from './cobertura';
import { Punto } from '../quotes/ubicacion';
import { User } from '../users/user.entity';
import { ordenarTiendasPorCalificacion, TiendaTop, FilaCalificacion } from './top-stores';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(CatalogProduct)
    private catalogRepository: Repository<CatalogProduct>,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}

  // Ferreterías con calificaciones de clientes, de mejor a peor. Solo datos públicos de la tienda.
  async getTopRatedStores(limite: number): Promise<TiendaTop[]> {
    const filas = await this.dataSource
      .getRepository(Quote)
      .createQueryBuilder('q')
      .innerJoin('q.store', 's')
      .select('s.uid', 'id')
      .addSelect('s.displayName', 'name')
      .addSelect('s.photoURL', 'photoUrl')
      .addSelect('s.specialties', 'specialties')
      .addSelect('s.location', 'location')
      .addSelect('AVG(q.rating)', 'average')
      .addSelect('COUNT(q.rating)', 'reviews')
      .where('q.rating BETWEEN 1 AND 5')
      .andWhere('s.role = :role', { role: 'STORE' })
      .groupBy('s.uid')
      .getRawMany<FilaCalificacion>();
    return ordenarTiendasPorCalificacion(filas, limite);
  }

  // Ferreterías que recibirían una solicitud con esta categoría y este radio: solo el número, nunca quiénes son.
  async contarCobertura(categoria: string, obra: Punto | null, radioKm: number): Promise<number> {
    const tiendas = await this.dataSource.getRepository(User).find({
      where: { role: 'STORE' as any },
      select: ['uid', 'specialties', 'location'],
    });
    return contarTiendasQueCubren(tiendas, categoria, obra, radioKm);
  }

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
    // Mismo filtro que el perfil de usuario: nunca role, email, password, isEmailVerified, uid, etc.
    const safeData: Record<string, any> = sanitizarPerfil(profileData ?? {});
    if (typeof profileData?.isProfileComplete === 'boolean') {
      safeData.isProfileComplete = profileData.isProfileComplete;
    }
    if (Object.keys(safeData).length === 0) {
      return perfilPropio(await this.usersService.findOne(storeId));
    }
    return perfilPropio(await this.usersService.update(storeId, safeData));
  }

  // Calificación que los clientes le han dado a la tienda; null mientras nadie la haya calificado.
  async getStoreRating(storeId: string): Promise<{ rating: number | null; reviews: number }> {
    const fila = await this.dataSource
      .getRepository(Quote)
      .createQueryBuilder('q')
      .select('AVG(q.rating)', 'average')
      .addSelect('COUNT(q.rating)', 'reviews')
      .where('q.storeId = :storeId', { storeId })
      .andWhere('q.rating BETWEEN 1 AND 5')
      .getRawOne<{ average: string | null; reviews: string }>();
    const reviews = Number(fila?.reviews ?? 0);
    const average = Number(fila?.average);
    return { rating: reviews > 0 && Number.isFinite(average) ? Math.round(average * 10) / 10 : null, reviews };
  }
}

