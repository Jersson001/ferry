import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioItem } from './portfolio-item.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioItem)
    private readonly portfolioRepository: Repository<PortfolioItem>,
    private readonly storageService: StorageService,
  ) {}

  async findAllByUser(userId: string): Promise<PortfolioItem[]> {
    return this.portfolioRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadAndCreate(
    file: Express.Multer.File,
    userId: string,
    description?: string,
  ): Promise<PortfolioItem> {
    // 1. Guardar y comprimir usando StorageModule
    const fileUrl = await this.storageService.saveFile(file, userId, 'portfolio');

    // 2. Determinar tipo
    const type = file.mimetype.startsWith('video') ? 'video' : 'image';

    // 3. Crear registro en base de datos
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

    // Borrar de la base de datos
    await this.portfolioRepository.remove(item);

    // Borrar del disco si es imagen/video local
    if (item.type !== 'link' && item.url.includes('/uploads/')) {
      this.storageService.deleteFile(item.url);
    }
  }
}
