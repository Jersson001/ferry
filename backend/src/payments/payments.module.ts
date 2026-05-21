import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { QuotesModule } from '../quotes/quotes.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction]),
    QuotesModule, // Necesitamos QuotesModule para cambiar el estado de la cotización a PAID
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
