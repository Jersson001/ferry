import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService], // Exportado para que Portfolio, Stores, etc. puedan inyectarlo
})
export class StorageModule {}
