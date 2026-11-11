import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { MaterialRequest } from './entities/material-request.entity';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { QuoteReview } from './entities/quote-review.entity';
import { QuoteMessage } from './entities/quote-message.entity';
import { QuoteChatService } from './chat/quote-chat.service';
import { QuoteChatController } from './chat/quote-chat.controller';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { QuotesCronService } from './quotes.cron';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialRequest, Quote, QuoteItem, QuoteReview, QuoteMessage]),
    UsersModule,
    PushModule,
    StorageModule,
  ],
  controllers: [QuotesController, QuoteChatController],
  providers: [QuotesService, QuotesCronService, QuoteChatService],
  exports: [QuotesService],
})
export class QuotesModule {}
