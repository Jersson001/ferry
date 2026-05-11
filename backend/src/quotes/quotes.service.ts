import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MaterialRequest, RequestStatus, PublicationType } from './entities/material-request.entity';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(MaterialRequest)
    private requestRepository: Repository<MaterialRequest>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    private dataSource: DataSource, // Para transacciones atómicas
  ) {}

  // ==========================================
  // CLIENTE: SOLICITUDES
  // ==========================================
  async createRequest(userId: string, data: any): Promise<MaterialRequest> {
    const request = this.requestRepository.create({
      userId,
      title: data.title,
      category: data.category,
      items: data.items,
      deliveryAddress: data.deliveryAddress,
      userLat: data.userLat,
      userLng: data.userLng,
      publicationType: data.publicationType || PublicationType.FREE,
      status: RequestStatus.OPEN,
      displayId: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
    });
    return this.requestRepository.save(request);
  }

  async findOneById(quoteId: string): Promise<Quote | null> {
    return this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: ['request'],
    });
  }

  async getOwnRequests(userId: string): Promise<MaterialRequest[]> {
    return this.requestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ==========================================
  // FERRETERÍA: VER SOLICITUDES
  // ==========================================
  async getPendingRequests(): Promise<MaterialRequest[]> {
    // Retorna las solicitudes ABIERTAS que las tiendas pueden cotizar
    return this.requestRepository.find({
      where: { status: RequestStatus.OPEN },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSentQuotes(storeId: string): Promise<any[]> {
    const quotes = await this.quoteRepository.find({
      where: { storeId },
      relations: ['request'],
      order: { createdAt: 'DESC' },
    });
    return quotes.map(q => ({
      ...q,
      requestTitle: q.request?.title,
      requestCategory: q.request?.category,
      requestDisplayId: q.request?.displayId
    }));
  }

  // ==========================================
  // FERRETERÍA: CREAR COTIZACIÓN (EL MOTOR CORE)
  // ==========================================
  async createQuote(storeId: string, requestId: string, data: any): Promise<Quote> {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.OPEN) throw new ForbiddenException('La solicitud ya no está abierta');

    // 1. Calcular totales desde el servidor (INMUTABILIDAD FINANCIERA)
    let storeBaseTotal = 0;
    const items: QuoteItem[] = [];

    for (const itemData of data.items) {
      const storeBaseUnitPrice = itemData.storeBaseUnitPrice;
      const quantity = itemData.quantity;
      const storeBaseSubtotal = storeBaseUnitPrice * quantity;
      
      // Markup del 14% + Redondeo
      const clientFinalUnitPrice = Math.round(storeBaseUnitPrice * 1.14);
      const clientFinalSubtotal = clientFinalUnitPrice * quantity;

      storeBaseTotal += storeBaseSubtotal;

      items.push(this.dataSource.getRepository(QuoteItem).create({
        name: itemData.name,
        nombreComercial: itemData.nombreComercial,
        quantity,
        unit: itemData.unit,
        sku: itemData.sku,
        available: itemData.available !== false,
        storeBaseUnitPrice,
        clientFinalUnitPrice,
        storeBaseSubtotal,
        clientFinalSubtotal,
      }));
    }

    const ferryCommission = Math.round(storeBaseTotal * 0.14);
    const ferryIva = Math.round(ferryCommission * 0.19);
    const transportCost = data.transportCost || 0;
    const clientFinalTotal = storeBaseTotal + ferryCommission + ferryIva + transportCost;

    // 2. Crear Cotización
    const quote = this.quoteRepository.create({
      requestId,
      storeId,
      status: QuoteStatus.PENDING,
      storeBaseTotal,
      ferryCommission,
      ferryIva,
      clientFinalTotal,
      transportCost,
      message: data.message,
      distanceKm: data.distanceKm,
      items,
    });

    return this.quoteRepository.save(quote);
  }

  // ==========================================
  // BLIND STRATEGY: VER COTIZACIONES (CLIENTE)
  // ==========================================
  async getReceivedQuotes(userId: string): Promise<any[]> {
    // 1. Obtener los IDs de las solicitudes del cliente
    const requests = await this.requestRepository.find({ where: { userId }, select: ['id'] });
    const requestIds = requests.map(r => r.id);

    if (requestIds.length === 0) return [];

    // 2. Buscar cotizaciones para esas solicitudes
    const quotes = await this.quoteRepository.createQueryBuilder('quote')
      .leftJoinAndSelect('quote.items', 'items')
      .leftJoinAndSelect('quote.store', 'store')
      .where('quote.request_id IN (:...requestIds)', { requestIds })
      .orderBy('quote.createdAt', 'DESC')
      .getMany();

    // 3. APLICAR BLIND STRATEGY (Ocultar datos si está PENDING/ACCEPTED/REJECTED)
    return quotes.map(quote => {
      // Remover datos sensibles internos
      delete (quote as any).storeBaseTotal;
      delete (quote as any).ferryCommission;
      delete (quote as any).ferryIva;
      
      quote.items.forEach(item => {
        delete (item as any).storeBaseUnitPrice;
        delete (item as any).storeBaseSubtotal;
      });

      // Si no ha pagado, NO MOSTRAR la tienda
      if (quote.status === QuoteStatus.PENDING || quote.status === QuoteStatus.ACCEPTED || quote.status === QuoteStatus.REJECTED) {
        return {
          ...quote,
          store: undefined, // Ocultar tienda completamente
          storeId: undefined, // Ocultar ID
          isBlind: true, // Flag para el frontend
        };
      }

      // Si pagó o ya se entregó, se liberan los datos
      return {
        ...quote,
        isBlind: false,
      };
    });
  }

  // ==========================================
  // TRANSACCIONES ATÓMICAS (ACEPTAR / PAGAR)
  // ==========================================
  async acceptQuote(quoteId: string, userId: string): Promise<Quote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Bloquear la cotización (Evitar race conditions)
      const quote = await queryRunner.manager.findOne(Quote, {
        where: { id: quoteId },
        relations: ['request'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!quote) throw new NotFoundException('Cotización no encontrada');
      if (quote.request.userId !== userId) throw new ForbiddenException('No es tu cotización');
      if (quote.status !== QuoteStatus.PENDING) throw new ForbiddenException('La cotización no está PENDING');

      // 2. Aceptar esta cotización
      quote.status = QuoteStatus.ACCEPTED;
      await queryRunner.manager.save(quote);

      // 3. Rechazar automáticamente las demás cotizaciones del mismo request
      await queryRunner.manager.update(Quote, 
        { requestId: quote.requestId, status: QuoteStatus.PENDING }, 
        { status: QuoteStatus.REJECTED }
      );

      await queryRunner.commitTransaction();
      return quote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async payQuote(quoteId: string, userId: string): Promise<Quote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloquear fila con write lock para evitar race conditions
      const quote = await queryRunner.manager.findOne(Quote, {
        where: { id: quoteId },
        relations: ['request'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!quote) throw new NotFoundException('Cotización no encontrada');
      if (quote.status === QuoteStatus.PAID) return quote; // Idempotencia
      if (quote.status !== QuoteStatus.ACCEPTED) {
        throw new ForbiddenException('Solo se pueden pagar cotizaciones aceptadas');
      }

      // PARCHE DE SEGURIDAD: Validar que la cotización pertenece al usuario que paga.
      // Excepción: SYSTEM_WEBHOOK cuando viene del procesador de webhooks de Wompi.
      if (userId !== 'SYSTEM_WEBHOOK' && quote.request.userId !== userId) {
        throw new ForbiddenException('No tienes permiso para pagar esta cotización');
      }

      // 1. Marcar como pagada
      quote.status = QuoteStatus.PAID;
      await queryRunner.manager.save(quote);

      // 2. Marcar la solicitud original como completada
      const request = quote.request;
      request.status = RequestStatus.COMPLETED;
      await queryRunner.manager.save(request);

      await queryRunner.commitTransaction();
      return quote;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateQuoteStatus(
    quoteId: string, 
    status: QuoteStatus, 
    userId: string, 
    isStore: boolean,
    rating?: number,
    comment?: string
  ): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId }, relations: ['request'] });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    
    if (isStore && quote.storeId !== userId) throw new ForbiddenException('No es tu cotización');
    if (!isStore && quote.request.userId !== userId) throw new ForbiddenException('No es tu solicitud');

    quote.status = status;

    if (status === QuoteStatus.DELIVERED) {
      if (rating !== undefined) quote.rating = rating;
      if (comment !== undefined) quote.reviewComment = comment;
    }

    return this.quoteRepository.save(quote);
  }
}
