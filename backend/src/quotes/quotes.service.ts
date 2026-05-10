import { Injectable } from '@nestjs/common';

@Injectable()
export class QuotesService {
  async getReceivedQuotes(userId: string) {
    return []; // Temporal: retornar vacío para evitar 404
  }

  async getOwnRequests(userId: string) {
    return [];
  }

  async getPendingRequests() {
    return [];
  }
}
