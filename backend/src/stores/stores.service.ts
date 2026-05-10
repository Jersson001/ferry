import { Injectable } from '@nestjs/common';

@Injectable()
export class StoresService {
  async getCatalog(storeId: string) {
    return []; // Temporal: retornar catálogo vacío
  }

  async getFamilies(storeId: string) {
    return []; // Temporal: retornar familias vacías
  }
}
