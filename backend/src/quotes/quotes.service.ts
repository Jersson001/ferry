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

  async getQuoteCountForRequest(requestId: string): Promise<number> {
    return this.quoteRepository.count({ where: { requestId } });
  }

  // ==========================================
  // FERRETERÍA: VER SOLICITUDES
  // ==========================================
  async getPendingRequests(storeId: string): Promise<MaterialRequest[]> {
    // 1. Obtener los IDs de las solicitudes que esta tienda ya cotizó
    const existingQuotes = await this.quoteRepository.find({
      where: { storeId },
      select: ['requestId']
    });
    const quotedRequestIds = existingQuotes.map(q => q.requestId);

    // 2. Retornar las solicitudes ABIERTAS que NO han sido cotizadas por la tienda
    const query = this.requestRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .where('request.status = :status', { status: RequestStatus.OPEN });

    if (quotedRequestIds.length > 0) {
      query.andWhere('request.id NOT IN (:...quotedRequestIds)', { quotedRequestIds });
    }

    return query.orderBy('request.createdAt', 'DESC').getMany();
  }

  async getPendingRequestsCount(storeId: string): Promise<number> {
    const existingQuotes = await this.quoteRepository.find({
      where: { storeId },
      select: ['requestId']
    });
    const quotedRequestIds = existingQuotes.map(q => q.requestId);

    const query = this.requestRepository.createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.OPEN });

    if (quotedRequestIds.length > 0) {
      query.andWhere('request.id NOT IN (:...quotedRequestIds)', { quotedRequestIds });
    }

    return query.getCount();
  }

  async getSentQuotes(storeId: string): Promise<any[]> {
    const quotes = await this.quoteRepository.find({
      where: { storeId },
      relations: ['request', 'request.user', 'items', 'store'],
      order: { createdAt: 'DESC' },
    });
    return quotes.map(q => {
      let mappedStatus = q.status as string;
      if (mappedStatus === QuoteStatus.PENDING) mappedStatus = 'sent';
      else mappedStatus = mappedStatus.toLowerCase();

      const isPaidOrLater = [QuoteStatus.PAID, QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED].includes(q.status);

      return {
        ...q,
        status: mappedStatus,
        total: q.clientFinalTotal,
        storeTotal: q.storeBaseTotal + (q.transportCost || 0),
        storeName: q.store?.displayName || q.store?.email || 'Tienda',
        requestTitle: q.request?.title,
        requestCategory: q.request?.category,
        requestDisplayId: q.request?.displayId,
        clientName: isPaidOrLater ? q.request?.user?.displayName : undefined,
        clientPhone: isPaidOrLater ? q.request?.user?.phoneNumber : undefined,
        items: q.items?.map(i => ({
          ...i,
          subtotal: i.storeBaseSubtotal,
          unitPrice: i.storeBaseUnitPrice
        })) || []
      };
    });
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
      .where('quote.requestId IN (:...requestIds)', { requestIds })
      .orderBy('quote.createdAt', 'DESC')
      .getMany();

    // 3. APLICAR BLIND STRATEGY (Ocultar datos si está PENDING/ACCEPTED/REJECTED)
    return quotes.map(quote => {
      let mappedStatus = quote.status as string;
      if (mappedStatus === QuoteStatus.PENDING) mappedStatus = 'sent';
      else mappedStatus = mappedStatus.toLowerCase();

      const mappedQuote = {
        ...quote,
        status: mappedStatus,
        total: quote.clientFinalTotal,
        storeName: quote.store?.displayName || quote.store?.email || 'Tienda',
        items: quote.items.map(item => ({
          ...item,
          unitPrice: item.clientFinalUnitPrice,
          subtotal: item.clientFinalSubtotal,
        })),
        review: (quote.rating !== undefined && quote.rating !== null) ? {
          rating: quote.rating,
          comment: quote.reviewComment,
          createdAt: quote.createdAt,
        } : undefined
      };

      // Remover datos sensibles internos
      delete (mappedQuote as any).storeBaseTotal;
      delete (mappedQuote as any).ferryCommission;
      delete (mappedQuote as any).ferryIva;
      delete (mappedQuote as any).clientFinalTotal;
      
      mappedQuote.items.forEach(item => {
        delete (item as any).storeBaseUnitPrice;
        delete (item as any).storeBaseSubtotal;
        delete (item as any).clientFinalUnitPrice;
        delete (item as any).clientFinalSubtotal;
      });

      // Si no ha pagado, NO MOSTRAR la tienda
      if (quote.status === QuoteStatus.PENDING || quote.status === QuoteStatus.ACCEPTED || quote.status === QuoteStatus.REJECTED) {
        return {
          ...mappedQuote,
          store: undefined, // Ocultar tienda completamente
          storeId: undefined, // Ocultar ID
          storeName: undefined, // Ocultar nombre
          isBlind: true, // Flag para el frontend
        };
      }

      // Si pagó o ya se entregó, se liberan los datos
      return {
        ...mappedQuote,
        isBlind: false,
      };
    });
  }

  // ==========================================
  // TRANSACCIONES ATÓMICAS (ACEPTAR / PAGAR)
  // ==========================================
  async acceptQuote(quoteId: string, userId: string, createSplit: boolean = false): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Bloquear la cotización usando QueryBuilder para evitar JOINs automáticos con FOR UPDATE
      const quote = await queryRunner.manager.createQueryBuilder(Quote, 'q')
        .innerJoinAndSelect('q.request', 'request')
        .where('q.id = :id', { id: quoteId })
        .setLock('pessimistic_write')
        .getOne();

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

      // 4. Lógica de Split Order
      let splitCreated = false;
      let splitRequestId: string | undefined = undefined;

      if (createSplit) {
        quote.items = await queryRunner.manager.find(QuoteItem, { where: { quoteId: quote.id } });
        const unavailableItems = quote.items.filter(item => !item.available);
        if (unavailableItems.length > 0) {
          const newRequest = this.requestRepository.create({
            userId: quote.request.userId,
            title: quote.request.title + ' (Complemento)',
            category: quote.request.category,
            items: unavailableItems.map(i => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit
            })),
            deliveryAddress: quote.request.deliveryAddress,
            userLat: quote.request.userLat,
            userLng: quote.request.userLng,
            publicationType: quote.request.publicationType,
            status: RequestStatus.OPEN,
            displayId: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
          });
          const savedNewRequest = await queryRunner.manager.save(newRequest);
          splitCreated = true;
          splitRequestId = savedNewRequest.id;
        }
      }

      await queryRunner.commitTransaction();
      return {
        ...quote,
        splitCreated,
        splitRequestId
      };
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
      // Bloquear fila con write lock usando QueryBuilder para evitar LEFT JOIN automáticos
      const quote = await queryRunner.manager.createQueryBuilder(Quote, 'q')
        .where('q.id = :id', { id: quoteId })
        .setLock('pessimistic_write')
        .getOne();

      if (!quote) throw new NotFoundException('Cotización no encontrada');
      if (quote.status === QuoteStatus.PAID) return quote; // Idempotencia
      if (quote.status !== QuoteStatus.ACCEPTED && quote.status !== QuoteStatus.PENDING) {
        throw new ForbiddenException('La cotización no está en estado válido para pagar');
      }

      // Obtener el request por separado
      const request = await queryRunner.manager.findOne(MaterialRequest, {
        where: { id: quote.requestId },
      });

      if (!request) throw new NotFoundException('Solicitud original no encontrada');

      // PARCHE DE SEGURIDAD: Validar que la cotización pertenece al usuario que paga.
      // Excepción: SYSTEM_WEBHOOK cuando viene del procesador de webhooks de Wompi.
      if (userId !== 'SYSTEM_WEBHOOK' && request.userId !== userId) {
        throw new ForbiddenException('No tienes permiso para pagar esta cotización');
      }

      const wasPending = quote.status === QuoteStatus.PENDING;

      // 1. Marcar como pagada
      quote.status = QuoteStatus.PAID;
      await queryRunner.manager.save(quote);

      if (wasPending) {
        // Rechazar automáticamente las demás cotizaciones del mismo request
        await queryRunner.manager.update(Quote, 
          { requestId: quote.requestId, status: QuoteStatus.PENDING }, 
          { status: QuoteStatus.REJECTED }
        );
      }

      // 2. Marcar la solicitud original como completada
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

    // Registrar timestamp de envío para el cron de auto-entrega (72h)
    if (status === QuoteStatus.SHIPPED && !quote.shippedAt) {
      quote.shippedAt = new Date();
    }

    if (status === QuoteStatus.DELIVERED) {
      quote.rating = (rating !== undefined && rating > 0) ? rating : null;
      quote.reviewComment = (comment !== undefined && comment.trim() !== '') ? comment : null;
    }

    return this.quoteRepository.save(quote);
  }
}
