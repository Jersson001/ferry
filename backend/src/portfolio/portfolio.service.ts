import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioItem } from './portfolio-item.entity';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioItem)
    private readonly portfolioRepository: Repository<PortfolioItem>,
    private readonly storageService: StorageService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async findAllByUser(userId: string): Promise<PortfolioItem[]> {
    return this.portfolioRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Verifica que el usuario no haya superado el límite de ítems de su plan.
   */
  private async checkPortfolioLimit(userId: string): Promise<void> {
    const limit = await this.subscriptionsService.getPortfolioLimit(userId);
    if (limit === -1) return; // Ilimitado (plan premium)

    const count = await this.portfolioRepository.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${limit} elemento(s) en tu portafolio. Actualiza tu plan para agregar más.`,
      );
    }
  }

  async uploadAndCreate(
    file: Express.Multer.File,
    userId: string,
    description?: string,
  ): Promise<PortfolioItem> {
    // 1. Verificar límite del plan antes de guardar el archivo
    await this.checkPortfolioLimit(userId);

    // 2. Guardar y comprimir usando StorageModule
    const fileUrl = await this.storageService.saveFile(file, userId, 'portfolio');

    // 3. Determinar tipo
    const type = file.mimetype.startsWith('video') ? 'video' : 'image';

    // 4. Crear registro en base de datos
    const item = this.portfolioRepository.create({
      userId,
      type,
      url: fileUrl,
      description,
    });

    return this.portfolioRepository.save(item);
  }

  async createLink(
    userId: string,
    url: string,
    description?: string,
  ): Promise<PortfolioItem> {
    // Verificar límite del plan antes de guardar el enlace
    await this.checkPortfolioLimit(userId);

    const item = this.portfolioRepository.create({
      userId,
      type: 'link',
      url,
      description,
    });
    return this.portfolioRepository.save(item);
  }

  async deleteItem(id: string, userId: string): Promise<void> {
    const item = await this.portfolioRepository.findOne({ where: { id } });

    if (!item) {
      throw new NotFoundException('Item no encontrado');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este item');
    }

    await this.portfolioRepository.remove(item);

    if (item.type !== 'link' && this.storageService.isStoredFile(item.url)) {
      await this.storageService.deleteFile(item.url);
    }
  }
}
