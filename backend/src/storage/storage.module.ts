import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

@Module({
  providers: [StorageService],
  exports: [StorageService], // Exportado para que Portfolio, Stores, etc. puedan inyectarlo
})
export class StorageModule {}
