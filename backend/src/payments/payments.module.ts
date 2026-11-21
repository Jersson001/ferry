import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { QuotesModule } from '../quotes/quotes.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction]),
    QuotesModule, // Necesitamos QuotesModule para cambiar el estado de la cotización a PAID
    forwardRef(() => SubscriptionsModule),
    StorageModule, // Fotos de los comprobantes de pago manual
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
