import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { CatalogController } from './catalog.controller';
import { CatalogProduct } from './entities/catalog-product.entity';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogProduct]),
    UsersModule,
    StorageModule,
  ],
  controllers: [StoresController, CatalogController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}

