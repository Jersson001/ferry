import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { QuoteStatus } from './entities/quote.entity';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  // ==========================================
  // CLIENTE
  // ==========================================
  @Post('requests')
  async createRequest(@Req() req: RequestWithUser, @Body() data: any) {
    return this.quotesService.createRequest(req.user.uid, data);
  }

  // Cuánto ha usado Ferry quien consulta: solicitudes hechas y pedidos entregados
  @Get('my-activity')
  async getMyActivity(@Req() req: RequestWithUser) {
    return (await this.quotesService.historialDeClientes([req.user.uid])).get(req.user.uid);
  }

  @Get('requests/own')
  async getOwnRequests(@Req() req: RequestWithUser) {
    return this.quotesService.getOwnRequests(req.user.uid);
  }

  /** POST /quotes/requests/:id/republish — El cliente vuelve a enviar una solicitud vencida (otra hora) */
  @Post('requests/:id/republish')
  async republish(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.republicarSolicitud(id, req.user.uid);
  }

  /** POST /quotes/requests/:id/delete — Borra una solicitud abierta de más de 48 h sin respuesta */
  @Post('requests/:id/delete')
  async deleteRequest(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.borrarSolicitud(id, req.user.uid);
  }

  /** POST /quotes/requests/:id/save-list — La guarda como lista reutilizable y la cancela */
  @Post('requests/:id/save-list')
  async saveAsList(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.guardarComoLista(id, req.user.uid);
  }

  /** PUT /quotes/lists/:id — Edita nombre y artículos de una lista guardada */
  @Put('lists/:id')
  async editList(@Param('id') id: string, @Body() body: any, @Req() req: RequestWithUser) {
    return this.quotesService.editarLista(id, req.user.uid, body ?? {});
  }

  /** POST /quotes/lists/:id/send — Publica una solicitud nueva con la lista (la lista se conserva) */
  @Post('lists/:id/send')
  async sendList(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.enviarLista(id, req.user.uid);
  }

  /** POST /quotes/lists/:id/delete — Borra una lista guardada */
  @Post('lists/:id/delete')
  async deleteList(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.borrarLista(id, req.user.uid);
  }

  @Get('requests/:id/quote-count')
  async getQuoteCount(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Verify ownership: only the request owner may query its quote count
    const ownRequests = await this.quotesService.getOwnRequests(req.user.uid);
    const owns = ownRequests.some(r => r.id === id);
    if (!owns) throw new ForbiddenException('No tienes permiso para ver esta solicitud');
    const count = await this.quotesService.getQuoteCountForRequest(id);
    return { count };
  }

  @Get('responses/received')
  async getReceived(@Req() req: RequestWithUser) {
    return this.quotesService.getReceivedQuotes(req.user.uid);
  }

  @Post(':id/accept')
  async acceptQuote(@Param('id') id: string, @Body('createSplit') createSplit: boolean, @Req() req: RequestWithUser) {
    return this.quotesService.acceptQuote(id, req.user.uid, createSplit);
  }

  @Post(':id/reject')
  async rejectQuote(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.quotesService.updateQuoteStatus(id, QuoteStatus.REJECTED, req.user.uid, false);
  }



  @Post(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: QuoteStatus,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
    @Req() req: RequestWithUser
  ) {
    const isStore = req.user.role === 'STORE';

    // ── Whitelist de estados permitidos por rol ───────────────────────────────
    // El cliente NUNCA puede marcar PAID, PREPARING, SHIPPED, DELIVERED
    const CLIENT_ALLOWED: QuoteStatus[] = [QuoteStatus.REJECTED, QuoteStatus.DELIVERED];
    // La tienda NUNCA puede marcar ACCEPTED o REJECTED (eso lo hace el cliente o el sistema)
    const STORE_ALLOWED: QuoteStatus[] = [QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED];

    const allowed = isStore ? STORE_ALLOWED : CLIENT_ALLOWED;
    if (!allowed.includes(status)) {
      throw new ForbiddenException(`Tu rol no puede establecer el estado "${status}"`);
    }

    return this.quotesService.updateQuoteStatus(id, status, req.user.uid, isStore, rating, comment);
  }

  // Solo la tienda dueña del pedido responde, y una sola vez por opinión
  @Post(':id/review-reply')
  async replyToReview(@Param('id') id: string, @Body('text') text: string, @Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.responderOpinion(id, req.user.uid, text);
  }

  @Post(':id/review-hidden')
  async hideReview(@Param('id') id: string, @Body('hidden') hidden: boolean, @Req() req: RequestWithUser) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Solo administradores');
    return this.quotesService.ocultarOpinion(id, hidden !== false);
  }

  // ==========================================
  // FERRETERÍA
  // ==========================================
  @Get('requests/pending')
  async getPending(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.getPendingRequests(req.user.uid);
  }

  @Get('requests/pending-count')
  async getPendingCount(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    const count = await this.quotesService.getPendingRequestsCount(req.user.uid);
    return { count };
  }

  @Get('responses/sent')
  async getSentQuotes(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.getSentQuotes(req.user.uid);
  }

  @Get('responses/cupo')
  async getCupoDiario(@Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.getCupoDiario(req.user.uid);
  }

  @Post('responses')
  async createResponse(@Req() req: RequestWithUser, @Body() data: any) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    return this.quotesService.createQuote(req.user.uid, data.requestId, data);
  }

  @Post(':id/logistic-status')
  async updateLogisticStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: RequestWithUser) {
    if (req.user.role !== 'STORE') throw new ForbiddenException('Solo tiendas');
    const upperStatus = String(status || '').toUpperCase() as QuoteStatus;
    // Igual que en :id/status: la tienda solo avanza la logística, nunca marca pagado ni aceptado
    if (![QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED].includes(upperStatus)) {
      throw new ForbiddenException(`Tu rol no puede establecer el estado "${upperStatus}"`);
    }
    return this.quotesService.updateQuoteStatus(id, upperStatus, req.user.uid, true);
  }
}
