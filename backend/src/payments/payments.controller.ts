import { Controller, Get, Post, Body, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { QuotesService } from '../quotes/quotes.service';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly quotesService: QuotesService
  ) {}

  // ==========================================
  // ENDPOINT PRIVADO: Obtener Firma para Frontend
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Get('wompi/signature/:quoteId')
  async getSignature(@Param('quoteId') quoteId: string, @Req() req: RequestWithUser) {
    // 1. Obtener los detalles de la cotización directamente de la base de datos
    const quote = await this.quotesService.findOneById(quoteId);
    
    if (!quote || quote.request?.userId !== req.user.uid) {
      throw new NotFoundException('Cotización no encontrada o no te pertenece');
    }

    // 2. Generar referencia única (QUOTE-uuid-timestamp)
    const reference = `QUOTE-${quote.id}-${Date.now()}`;
    const amountInCents = Math.round(quote.clientFinalTotal * 100);
    
    // 3. Generar la firma segura en el servidor
    const signature = this.paymentsService.generateWidgetSignature(reference, amountInCents, 'COP');

    // 4. Retornar todo lo que el frontend necesita para configurar el widget de Wompi
    return {
      reference,
      amountInCents,
      currency: 'COP',
      signature
    };
  }

  // ==========================================
  // ENDPOINT PÚBLICO: Webhook desde Wompi
  // ==========================================
  @Post('wompi-webhook')
  async handleWebhook(@Body() payload: any) {
    // Wompi hace POST a esta URL. No usamos JwtAuthGuard porque Wompi no tiene nuestro JWT.
    // La seguridad está en verificar la firma criptográfica (Webhook Events Secret)
    await this.paymentsService.processWompiWebhook(payload);
    
    // Wompi exige que respondamos HTTP 200 OK rápidamente
    return { received: true };
  }

  // ==========================================
  // ENDPOINT: Verificación segura de pago Wompi
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async verifyPayment(
    @Body('quoteId') quoteId: string, 
    @Body('transactionId') transactionId: string, 
    @Req() req: RequestWithUser
  ) {
    return this.paymentsService.verifyWompiTransaction(quoteId, transactionId, req.user.uid);
  }

  // ==========================================
  // ENDPOINT: Pago Manual (Nequi / Comprobantes)
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Post('manual')
  async registerManualPayment(
    @Body('quoteId') quoteId: string, 
    @Body('reference') reference: string, 
    @Body('proofBase64') proofBase64: string,
    @Req() req: RequestWithUser
  ) {
    return this.paymentsService.processManualPayment(quoteId, reference, proofBase64, req.user.uid);
  }
}
