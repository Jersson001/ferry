import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { MaterialRequest } from './entities/material-request.entity';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { QuoteReview } from './entities/quote-review.entity';
import { UsersModule } from '../users/users.module';
import { QuotesCronService } from './quotes.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialRequest, Quote, QuoteItem, QuoteReview]),
    UsersModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuotesCronService],
  exports: [QuotesService],
})
export class QuotesModule {}
