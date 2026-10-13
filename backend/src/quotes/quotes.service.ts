import { Injectable, Optional, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { MaterialRequest, RequestStatus, PublicationType } from './entities/material-request.entity';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { User } from '../users/user.entity';
import { categoriasDeLaTienda, contactoPublico } from '../users/perfil';
import { UserSubscription, SubscriptionStatus } from '../subscriptions/entities/user-subscription.entity';
import { PushService } from '../push/push.service';
import { leerUbicacion, leerRadioKm, estaEnRadio, distanciaKm, Punto } from './ubicacion';
import { COTIZACIONES_POR_SOLICITUD, COTIZACIONES_DIARIAS_GRATIS, inicioDelDiaColombia, itemsDeCotizacionValidos } from './cupos';

// Solicitudes que aún tienen cupo: las que ya recibieron todas sus cotizaciones salen de la bandeja.
const CON_CUPO = '(SELECT COUNT(*) FROM quotes q WHERE q.request_id = request.id) < :cupoSolicitud';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(MaterialRequest)
    private requestRepository: Repository<MaterialRequest>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    private dataSource: DataSource, // Para transacciones atómicas
    @Optional() private push?: PushService,
  ) {}

  // ==========================================
  // CLIENTE: SOLICITUDES
  // ==========================================
  async createRequest(userId: string, data: any): Promise<MaterialRequest> {
    const ubicacion = leerUbicacion(data);
    const request = this.requestRepository.create({
      userId,
      title: data.title,
      category: data.category,
      items: data.items,
      deliveryAddress: data.deliveryAddress,
      imageUrl: this.sanitizeImageUrl(data.imageUrl),
      userLat: ubicacion?.lat,
      userLng: ubicacion?.lng,
      radioKm: leerRadioKm(data.radioKm),
      publicationType: data.publicationType || PublicationType.FREE,
      status: RequestStatus.OPEN,
      displayId: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
    });
    const guardada = await this.requestRepository.save(request);
    // Sin await: el aviso no debe demorar ni romper la respuesta al cliente.
    void this.push?.avisarSolicitud(guardada);
    return guardada;
  }

  // La foto se sube antes por /storage/upload; aquí solo se acepta la URL que devolvió.
  private sanitizeImageUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url || url.length > 2048) return null;
    return /^(https:\/\/|\/uploads\/)/.test(url) ? url : null;
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
  // Categorías de solicitud que la tienda tiene habilitadas. Sin especialidades no recibe ninguna.
  private async categoriasDeLaTienda(storeId: string): Promise<string[]> {
    const tienda = await this.dataSource.getRepository(User).findOne({
      where: { uid: storeId },
      select: ['uid', 'specialties'],
    });
    return categoriasDeLaTienda(tienda?.specialties);
  }

  // Dónde está la ferretería, si se sabe.
  private async ubicacionDeLaTienda(storeId: string): Promise<Punto | null> {
    const tienda = await this.dataSource.getRepository(User).findOne({ where: { uid: storeId }, select: ['uid', 'location'] });
    return leerUbicacion({ userLocation: tienda?.location });
  }

  // Deja solo las solicitudes dentro del radio que fijó el cliente y anota la distancia a la tienda.
  private dentroDelRadio(solicitudes: MaterialRequest[], tienda: Punto | null): any[] {
    return solicitudes
      .filter(r => estaEnRadio(tienda, leerUbicacion(r), r.radioKm ?? 10))
      .map(r => {
        const obra = leerUbicacion(r);
        return tienda && obra ? { ...r, distanceKm: Math.round(distanciaKm(tienda, obra) * 10) / 10 } : r;
      });
  }

  async getPendingRequests(storeId: string): Promise<MaterialRequest[]> {
    const categorias = await this.categoriasDeLaTienda(storeId);
    if (categorias.length === 0) return [];

    // 1. Obtener los IDs de las solicitudes que esta tienda ya cotizó
    const existingQuotes = await this.quoteRepository.find({
      where: { storeId },
      select: ['requestId']
    });
    const quotedRequestIds = existingQuotes.map(q => q.requestId);

    // 2. Retornar las solicitudes ABIERTAS de sus categorías que NO han sido cotizadas por la tienda.
    // No se carga el usuario que pidió: la tienda no lo necesita y esa fila trae su contraseña y sus tokens.
    const query = this.requestRepository.createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.OPEN })
      .andWhere('request.category IN (:...categorias)', { categorias })
      .andWhere(CON_CUPO, { cupoSolicitud: COTIZACIONES_POR_SOLICITUD });

    if (quotedRequestIds.length > 0) {
      query.andWhere('request.id NOT IN (:...quotedRequestIds)', { quotedRequestIds });
    }

    const solicitudes = await query.orderBy('request.createdAt', 'DESC').getMany();
    return this.dentroDelRadio(solicitudes, await this.ubicacionDeLaTienda(storeId));
  }

  async getPendingRequestsCount(storeId: string): Promise<number> {
    return (await this.getPendingRequests(storeId)).length;
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

      // La solicitud trae al cliente completo (correo, contraseña, tokens): solo se expone nombre y teléfono, y
      // únicamente cuando ya pagó. La tienda tampoco necesita que se le devuelva su propio usuario.
      const { request, store: _tienda, ...cotizacion } = q;
      const { user: _cliente, ...solicitud } = (request ?? {}) as MaterialRequest;

      return {
        ...cotizacion,
        request: request ? solicitud : undefined,
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
  // Una ferretería sin plan de pago activo tiene un tope de cotizaciones por día; con plan de pago no hay tope.
  async getCupoDiario(storeId: string): Promise<{ limite: number | null; usadas: number }> {
    const usadas = await this.quoteRepository.count({
      where: { storeId, createdAt: MoreThanOrEqual(inicioDelDiaColombia()) },
    });
    const planPago = await this.dataSource.getRepository(UserSubscription).findOne({
      where: { userId: storeId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });
    const conPlanDePago = !!planPago?.plan && planPago.plan.priceInCents > 0;
    return { limite: conPlanDePago ? null : COTIZACIONES_DIARIAS_GRATIS, usadas };
  }

  async createQuote(storeId: string, requestId: string, data: any): Promise<Quote> {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.OPEN) throw new ForbiddenException('La solicitud ya no está abierta');

    // Solo cotiza quien tiene la categoría habilitada: la bandeja ya la filtra, pero la ruta se puede llamar directo
    const categorias = await this.categoriasDeLaTienda(storeId);
    if (!categorias.includes(request.category)) {
      throw new ForbiddenException('Esta solicitud no es de tu especialidad');
    }

    const itemsInvalidos = itemsDeCotizacionValidos(data?.items);
    if (itemsInvalidos) throw new BadRequestException(itemsInvalidos);

    if (await this.quoteRepository.count({ where: { requestId, storeId } }) > 0) {
      throw new ConflictException('Ya cotizaste esta solicitud');
    }

    const cupo = await this.getCupoDiario(storeId);
    if (cupo.limite !== null && cupo.usadas >= cupo.limite) {
      throw new ForbiddenException(`Llegaste al máximo de ${cupo.limite} cotizaciones por día. Mañana se reinicia, o suscríbete para cotizar sin límite.`);
    }

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

    // Gana quien responde primero: se bloquea la solicitud para contar y guardar sin que dos tiendas
    // tomen a la vez el último cupo.
    return this.dataSource.transaction(async (manager) => {
      await manager.findOne(MaterialRequest, { where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
      const recibidas = await manager.count(Quote, { where: { requestId } });
      if (recibidas >= COTIZACIONES_POR_SOLICITUD) {
        throw new ConflictException('Esta solicitud ya recibió el máximo de cotizaciones');
      }
      return manager.save(Quote, quote);
    });
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
        // Solo contacto y presentación de la tienda: la fila completa trae su contraseña y su lista de precios
        store: contactoPublico(quote.store),
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

    // Solo el cliente califica: si la tienda pudiera hacerlo, se calificaría a sí misma, y marcar el
    // pedido como entregado no debe borrar la calificación que el cliente ya dejó.
    if (status === QuoteStatus.DELIVERED && !isStore) {
      const calificacionValida = Number.isInteger(rating) && rating! >= 1 && rating! <= 5;
      quote.rating = calificacionValida ? rating! : null;
      quote.reviewComment = (typeof comment === 'string' && comment.trim() !== '') ? comment : null;
    }

    return this.quoteRepository.save(quote);
  }
}
