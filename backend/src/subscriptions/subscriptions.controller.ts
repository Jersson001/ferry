import { Controller, Get, Post, Param, UseGuards, Req, Query, Body, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';
import { PaymentsService } from '../payments/payments.service';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService
  ) {}

  @Get('plans')
  async getPlans(@Query('role') role?: string) {
    // Público: todos pueden ver los precios
    return this.subscriptionsService.getPlans(role);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-subscription')
  async getMySubscription(@Req() req: RequestWithUser) {
    return this.subscriptionsService.getUserSubscription(req.user.uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ledger')
  async getMyLedger(@Req() req: RequestWithUser) {
    return this.subscriptionsService.getLedger(req.user.uid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase/:planId')
  async purchasePlan(@Param('planId') planId: string, @Req() req: RequestWithUser) {
    // Para MVP, simula la compra y asigna los créditos (ahora usado para planes gratuitos)
    return this.subscriptionsService.purchasePlan(req.user.uid, planId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('wompi/signature/:planId')
  async getWompiSignature(@Param('planId') planId: string, @Req() req: RequestWithUser) {
    const plans = await this.subscriptionsService.getPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const reference = `SUB_${req.user.uid}_${plan.id}_${Date.now()}`;
    const amountInCents = plan.priceInCents;
    const signature = this.paymentsService.generateWidgetSignature(reference, amountInCents, 'COP');

    return { reference, amountInCents, currency: 'COP', signature };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wompi/verify')
  async verifyWompiPayment(@Body('transactionId') transactionId: string, @Req() req: RequestWithUser) {
    return this.paymentsService.verifyWompiSubscriptionTransaction(transactionId, req.user.uid);
  }
}
