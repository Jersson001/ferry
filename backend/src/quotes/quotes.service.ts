import { Injectable, Optional, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual, In } from 'typeorm';
import { MaterialRequest, RequestStatus, PublicationType } from './entities/material-request.entity';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { User } from '../users/user.entity';
import { categoriasDeLaTienda, contactoPublico } from '../users/perfil';
import { limpiarTexto } from '../stores/opiniones';
import { armarHistorial, HistorialCliente } from './historial-cliente';
import { PushService } from '../push/push.service';
import { leerUbicacion, leerRadioKm, estaEnRadio, distanciaKm, Punto } from './ubicacion';
import { planVigente } from '../subscriptions/plan-vigente';
import { COTIZACIONES_POR_SOLICITUD, VIGENCIA_SOLICITUD_MS, publicadaEn, solicitudVigente, inicioDelDiaColombia, itemsDeCotizacionValidos } from './cupos';

// Solicitudes que aún tienen cupo: las que ya recibieron todas sus cotizaciones salen de la bandeja.
// Una solicitud abierta y sin respuesta durante 48 h se puede borrar o guardar como lista.
export const ARCHIVABLE_DESDE_MS = 48 * 60 * 60 * 1000;

// Artículos que el cliente edita en una lista guardada: se conservan los demás datos de cada artículo
// (nombre comercial, medida…) y se validan nombre, cantidad y unidad.
export function articulosDeLista(valor: unknown): any[] {
  if (!Array.isArray(valor) || valor.length === 0) throw new BadRequestException('La lista debe tener al menos un artículo');
  if (valor.length > 200) throw new BadRequestException('La lista tiene demasiados artículos');
  return valor.map((it: any) => {
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    const cantidad = Number(it?.quantity);
    if (!name || name.length > 200) throw new BadRequestException('Cada artículo necesita un nombre');
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 100000) throw new BadRequestException(`Cantidad inválida para "${name}"`);
    const unit = typeof it?.unit === 'string' && it.unit.trim() ? it.unit.trim().slice(0, 30) : 'und';
    return { ...it, name, quantity: String(cantidad), unit };
  });
}

// Pone los artículos cotizados en el mismo orden en que el cliente los pidió (por nombre); los que no
// coinciden quedan al final, en el orden en que llegaron.
export function ordenarComoSolicitud<T extends { name: string }>(cotizados: T[], pedidos?: Array<{ name?: string }> | null): T[] {
  if (!Array.isArray(pedidos) || pedidos.length === 0) return cotizados;
  const posicion = new Map<string, number>();
  pedidos.forEach((p, i) => { const k = (p?.name ?? '').trim().toLowerCase(); if (k && !posicion.has(k)) posicion.set(k, i); });
  const lugar = (it: T) => posicion.get((it.name ?? '').trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
  return cotizados.map((it, i) => ({ it, i })).sort((a, b) => lugar(a.it) - lugar(b.it) || a.i - b.i).map(x => x.it);
}

// Cada solicitud guarda su tope según el plan de quien la creó; las anteriores a los planes usan el general.
const CON_CUPO = '(SELECT COUNT(*) FROM quotes q WHERE q.request_id = request.id) < COALESCE(request.max_quotes, :cupoSolicitud)';

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
    const plan = await planVigente(this.dataSource.manager, userId);
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
      maxQuotes: plan.limites.tiendasPorSolicitud,
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

  // Las del cliente, con su vigencia: una abierta de más de una hora ya no la ven las ferreterías.
  async getOwnRequests(userId: string): Promise<Array<MaterialRequest & { vencida: boolean; venceEn: Date }>> {
    const solicitudes = await this.requestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const ahora = new Date();
    return solicitudes.map(r => ({
      ...r,
      vencida: r.status === RequestStatus.OPEN && !solicitudVigente(r, ahora),
      venceEn: new Date(new Date(publicadaEn(r)).getTime() + VIGENCIA_SOLICITUD_MS),
      // Abierta y sin respuesta hace más de 48 h: el cliente puede borrarla o guardarla como lista
      archivable: r.status === RequestStatus.OPEN && ahora.getTime() - new Date(publicadaEn(r)).getTime() >= ARCHIVABLE_DESDE_MS,
    }));
  }

  // Solicitud propia, abierta y sin una cotización ya aceptada o pagada (esas siguen su curso).
  private async solicitudArchivable(requestId: string, userId: string): Promise<MaterialRequest> {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request || request.userId !== userId) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.OPEN) throw new BadRequestException('Esta solicitud ya no está abierta');
    if (Date.now() - new Date(publicadaEn(request)).getTime() < ARCHIVABLE_DESDE_MS) {
      throw new BadRequestException('Solo se pueden borrar o guardar las solicitudes de más de 48 horas');
    }
    const enCurso = await this.quoteRepository.count({
      where: { requestId, status: In([QuoteStatus.ACCEPTED, QuoteStatus.PENDING_VALIDATION, QuoteStatus.PAID, QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED]) },
    });
    if (enCurso > 0) throw new BadRequestException('Esta solicitud tiene una cotización aceptada; no se puede borrar');
    return request;
  }

  /** Borra una solicitud vieja: queda cancelada y sale de "Enviadas" (los datos se conservan). */
  async borrarSolicitud(requestId: string, userId: string): Promise<{ ok: true }> {
    const request = await this.solicitudArchivable(requestId, userId);
    request.status = RequestStatus.CANCELLED;
    await this.requestRepository.save(request);
    return { ok: true };
  }

  /** Guarda los artículos de una solicitud vieja como lista reutilizable (borrador) y cancela la solicitud. */
  async guardarComoLista(requestId: string, userId: string): Promise<MaterialRequest> {
    const request = await this.solicitudArchivable(requestId, userId);
    const lista = await this.requestRepository.save(this.requestRepository.create({
      userId,
      title: request.title,
      category: request.category,
      items: request.items,
      deliveryAddress: request.deliveryAddress,
      imageUrl: request.imageUrl,
      userLat: request.userLat,
      userLng: request.userLng,
      radioKm: request.radioKm,
      publicationType: request.publicationType,
      status: RequestStatus.DRAFT,
      displayId: `LISTA-${Math.floor(10000 + Math.random() * 90000)}`,
    }));
    request.status = RequestStatus.CANCELLED;
    await this.requestRepository.save(request);
    return lista;
  }

  private async listaPropia(listaId: string, userId: string): Promise<MaterialRequest> {
    const lista = await this.requestRepository.findOne({ where: { id: listaId } });
    if (!lista || lista.userId !== userId || lista.status !== RequestStatus.DRAFT) throw new NotFoundException('Lista no encontrada');
    return lista;
  }

  /** Edita el nombre y los artículos de una lista guardada. */
  async editarLista(listaId: string, userId: string, data: { title?: unknown; items?: unknown }): Promise<MaterialRequest> {
    const lista = await this.listaPropia(listaId, userId);
    if (data.title !== undefined) {
      const titulo = typeof data.title === 'string' ? data.title.trim() : '';
      if (!titulo || titulo.length > 120) throw new BadRequestException('Escribe un nombre para la lista (máximo 120 caracteres)');
      lista.title = titulo;
    }
    if (data.items !== undefined) lista.items = articulosDeLista(data.items);
    return this.requestRepository.save(lista);
  }

  /** Publica una solicitud nueva con los artículos de la lista; la lista sigue guardada para otra vez. */
  async enviarLista(listaId: string, userId: string): Promise<MaterialRequest & { vencida: boolean; venceEn: Date }> {
    const lista = await this.listaPropia(listaId, userId);
    if (!Array.isArray(lista.items) || lista.items.length === 0) throw new BadRequestException('La lista no tiene artículos');
    const nueva = await this.createRequest(userId, {
      title: lista.title,
      category: lista.category,
      items: lista.items,
      deliveryAddress: lista.deliveryAddress,
      imageUrl: lista.imageUrl,
      userLat: lista.userLat,
      userLng: lista.userLng,
      radioKm: lista.radioKm,
      publicationType: lista.publicationType,
    });
    return { ...nueva, vencida: false, venceEn: new Date(new Date(publicadaEn(nueva) ?? new Date()).getTime() + VIGENCIA_SOLICITUD_MS) };
  }

  /** Borra una lista guardada. */
  async borrarLista(listaId: string, userId: string): Promise<{ ok: true }> {
    const lista = await this.listaPropia(listaId, userId);
    lista.status = RequestStatus.CANCELLED;
    await this.requestRepository.save(lista);
    return { ok: true };
  }

  /** El cliente vuelve a enviar una solicitud vencida: corre otra hora y se avisa de nuevo a las ferreterías. */
  async republicarSolicitud(requestId: string, userId: string) {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request || request.userId !== userId) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.OPEN) throw new BadRequestException('Esta solicitud ya no está abierta');
    if (solicitudVigente(request)) throw new BadRequestException('La solicitud sigue publicada; espera a que venza para volver a enviarla');
    request.publishedAt = new Date();
    const guardada = await this.requestRepository.save(request);
    void this.push?.avisarSolicitud(guardada);
    return { ...guardada, vencida: false, venceEn: new Date(guardada.publishedAt!.getTime() + VIGENCIA_SOLICITUD_MS) };
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

  async getPendingRequests(storeId: string): Promise<Array<MaterialRequest & { client: HistorialCliente }>> {
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
      .andWhere(CON_CUPO, { cupoSolicitud: COTIZACIONES_POR_SOLICITUD })
      // Solo las de la última hora: las viejas no aparecen, ni siquiera a una ferretería que entra después.
      .andWhere('COALESCE(request.publishedAt, request.createdAt) >= :vigenteDesde', {
        vigenteDesde: new Date(Date.now() - VIGENCIA_SOLICITUD_MS),
      });

    if (quotedRequestIds.length > 0) {
      query.andWhere('request.id NOT IN (:...quotedRequestIds)', { quotedRequestIds });
    }

    const solicitudes = await query.orderBy('request.createdAt', 'DESC').getMany();
    const enRadio = this.dentroDelRadio(solicitudes, await this.ubicacionDeLaTienda(storeId));
    // Cuánto ha usado Ferry quien pide: solo cifras, nunca quién es.
    const historial = await this.historialDeClientes(enRadio.map(r => r.userId));
    return enRadio.map(r => ({ ...r, client: historial.get(r.userId) ?? armarHistorial(0, 0) }));
  }

  // Solicitudes hechas y pedidos entregados de cada cliente, en dos consultas agrupadas.
  async historialDeClientes(userIds: string[]): Promise<Map<string, HistorialCliente>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    const r = new Map<string, HistorialCliente>();
    if (ids.length === 0) return r;
    const [hechas, entregadas] = await Promise.all([
      this.requestRepository
        .createQueryBuilder('r')
        .select('r.userId', 'userId')
        .addSelect('COUNT(*)', 'n')
        .where('r.userId IN (:...ids)', { ids })
        .andWhere('r.status <> :borrador', { borrador: RequestStatus.DRAFT })
        .groupBy('r.userId')
        .getRawMany<{ userId: string; n: string }>(),
      this.quoteRepository
        .createQueryBuilder('q')
        .innerJoin('q.request', 'r')
        .select('r.userId', 'userId')
        .addSelect('COUNT(*)', 'n')
        .where('r.userId IN (:...ids)', { ids })
        .andWhere('q.status = :entregado', { entregado: QuoteStatus.DELIVERED })
        .groupBy('r.userId')
        .getRawMany<{ userId: string; n: string }>(),
    ]);
    const h = new Map(hechas.map(x => [x.userId, x.n]));
    const e = new Map(entregadas.map(x => [x.userId, x.n]));
    for (const id of ids) r.set(id, armarHistorial(h.get(id), e.get(id)));
    return r;
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
    // El tope sale del plan vigente de la ferretería (un plan de pago vencido vuelve al gratuito).
    const plan = await planVigente(this.dataSource.manager, storeId);
    const limite = plan.limites.cotizacionesDiarias;
    return { limite: limite === -1 ? null : limite, usadas };
  }


  async createQuote(storeId: string, requestId: string, data: any): Promise<Quote> {
    const request = await this.requestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== RequestStatus.OPEN) throw new ForbiddenException('La solicitud ya no está abierta');
    if (!solicitudVigente(request)) throw new ForbiddenException('Esta solicitud ya venció: solo se puede cotizar durante su primera hora');

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
      throw new ForbiddenException(`Llegaste al máximo de ${cupo.limite} cotizaciones por día. Mañana se reinicia, o mejora tu plan para cotizar más.`);
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
      const solicitud = await manager.findOne(MaterialRequest, { where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
      const recibidas = await manager.count(Quote, { where: { requestId } });
      if (recibidas >= (solicitud?.maxQuotes ?? COTIZACIONES_POR_SOLICITUD)) {
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
      // Solo el nombre y el código de la solicitud (son del mismo cliente), para mostrarlos en el aviso
      .leftJoin('quote.request', 'request')
      .addSelect(['request.id', 'request.title', 'request.displayId', 'request.category', 'request.items'])
      .where('quote.requestId IN (:...requestIds)', { requestIds })
      .orderBy('quote.createdAt', 'DESC')
      .getMany();

    // Sello de verificado del plan de cada ferretería. No revela quién es, así que se muestra aunque la
    // cotización siga a ciegas.
    const verificadas = new Set<string>();
    for (const storeId of new Set(quotes.map(q => q.storeId))) {
      if ((await planVigente(this.dataSource.manager, storeId)).verificado) verificadas.add(storeId);
    }

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
        storeVerified: verificadas.has(quote.storeId),
        request: undefined,
        requestTitle: quote.request?.title,
        requestDisplayId: quote.request?.displayId,
        requestCategory: quote.request?.category,
        // Los artículos de la cotización no guardan orden: se muestran en el de la solicitud
        items: ordenarComoSolicitud(quote.items, quote.request?.items).map(item => ({
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
      if ([QuoteStatus.PENDING, QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.PENDING_VALIDATION].includes(quote.status)) {
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
      // PENDING_VALIDATION: lo aprueba un administrador, o el cliente terminó pagando por Wompi mientras tanto
      if (![QuoteStatus.ACCEPTED, QuoteStatus.PENDING, QuoteStatus.PENDING_VALIDATION].includes(quote.status)) {
        throw new ForbiddenException('La cotización no está en estado válido para pagar');
      }

      // Obtener el request por separado
      const request = await queryRunner.manager.findOne(MaterialRequest, {
        where: { id: quote.requestId },
      });

      if (!request) throw new NotFoundException('Solicitud original no encontrada');

      // PARCHE DE SEGURIDAD: Validar que la cotización pertenece al usuario que paga.
      // Excepción: SYSTEM_WEBHOOK cuando viene del procesador de webhooks de Wompi.
      // SYSTEM_ADMIN: un administrador aprobó el comprobante de un pago manual.
      if (userId !== 'SYSTEM_WEBHOOK' && userId !== 'SYSTEM_ADMIN' && request.userId !== userId) {
        throw new ForbiddenException('No tienes permiso para pagar esta cotización');
      }

      // Un comprobante pudo llegar con la cotización aún PENDING: al pagarse, las demás también se descartan.
      const wasPending = quote.status === QuoteStatus.PENDING || quote.status === QuoteStatus.PENDING_VALIDATION;

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

  /**
   * El cliente subió un comprobante: la cotización queda en revisión (no pagada). Devuelve el estado
   * que tenía, para poder regresarla ahí si el administrador rechaza el comprobante.
   */
  async marcarEnValidacion(quoteId: string, userId: string): Promise<{ antes: QuoteStatus; clientFinalTotal: number }> {
    return this.dataSource.transaction(async manager => {
      const quote = await manager.createQueryBuilder(Quote, 'q')
        .where('q.id = :id', { id: quoteId })
        .setLock('pessimistic_write')
        .getOne();
      if (!quote) throw new NotFoundException('Cotización no encontrada');
      const request = await manager.findOne(MaterialRequest, { where: { id: quote.requestId } });
      if (!request || request.userId !== userId) throw new ForbiddenException('No tienes permiso para pagar esta cotización');
      if (quote.status === QuoteStatus.PENDING_VALIDATION) {
        throw new ConflictException('Ya enviaste un comprobante para este pedido; Ferry lo está revisando');
      }
      if (quote.status !== QuoteStatus.PENDING && quote.status !== QuoteStatus.ACCEPTED) {
        throw new BadRequestException('Este pedido no está pendiente de pago');
      }
      const antes = quote.status;
      quote.status = QuoteStatus.PENDING_VALIDATION;
      await manager.save(quote);
      return { antes, clientFinalTotal: quote.clientFinalTotal };
    });
  }

  /** Comprobante rechazado: la cotización vuelve a esperar el pago, solo si sigue en revisión. */
  async quitarValidacion(quoteId: string, volverA: QuoteStatus): Promise<void> {
    const destino = volverA === QuoteStatus.PENDING ? QuoteStatus.PENDING : QuoteStatus.ACCEPTED;
    await this.quoteRepository.update({ id: quoteId, status: QuoteStatus.PENDING_VALIDATION }, { status: destino });
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

    // Solo se alista, despacha o entrega lo que ya está pagado, y solo se rechaza lo que aún no se ha pagado
    // (con un comprobante en revisión tampoco: el cliente ya envió la plata).
    const pagada = [QuoteStatus.PAID, QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED].includes(quote.status);
    if ([QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED].includes(status) && !pagada) {
      throw new BadRequestException('Este pedido todavía no está pagado');
    }
    if (status === QuoteStatus.REJECTED && ![QuoteStatus.PENDING, QuoteStatus.ACCEPTED, QuoteStatus.REJECTED].includes(quote.status)) {
      throw new BadRequestException('Este pedido ya no se puede rechazar');
    }

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
      quote.reviewComment = limpiarTexto(comment);
      quote.reviewedAt = calificacionValida ? new Date() : null;
    }

    return this.quoteRepository.save(quote);
  }

  // La tienda responde una vez a la opinión de un cliente. No puede editarla ni borrarla.
  async responderOpinion(quoteId: string, storeId: string, texto: unknown): Promise<{ reply: string }> {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (!quote || quote.storeId !== storeId) throw new NotFoundException('Opinión no encontrada');
    if (quote.rating == null) throw new BadRequestException('Este pedido aún no tiene calificación');
    if (quote.reviewReply) throw new ConflictException('Ya respondiste esta opinión');
    const reply = limpiarTexto(texto);
    if (!reply) throw new BadRequestException('Escribe tu respuesta');
    quote.reviewReply = reply;
    quote.reviewRepliedAt = new Date();
    await this.quoteRepository.save(quote);
    return { reply };
  }

  // Solo el administrador: oculta (o vuelve a mostrar) una opinión abusiva.
  async ocultarOpinion(quoteId: string, oculta: boolean): Promise<{ hidden: boolean }> {
    const quote = await this.quoteRepository.findOne({ where: { id: quoteId } });
    if (!quote || quote.rating == null) throw new NotFoundException('Opinión no encontrada');
    quote.reviewHidden = oculta;
    await this.quoteRepository.save(quote);
    return { hidden: oculta };
  }
}
