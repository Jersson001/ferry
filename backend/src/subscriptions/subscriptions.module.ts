import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { CreditLedger } from './entities/credit-ledger.entity';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, UserSubscription, CreditLedger]),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule implements OnModuleInit {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async onModuleInit() {
    // Autollenar la tabla de planes al iniciar si está vacía
    await this.subscriptionsService.seedPlans();
  }
}
