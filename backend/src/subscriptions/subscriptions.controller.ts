import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { uid: string; email: string; role: string };
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    // Público: todos pueden ver los precios
    return this.subscriptionsService.getPlans();
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
    // Para MVP, simula la compra y asigna los créditos
    return this.subscriptionsService.purchasePlan(req.user.uid, planId);
  }
}
