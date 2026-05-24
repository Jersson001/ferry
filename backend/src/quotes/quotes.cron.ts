import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Quote, QuoteStatus } from './entities/quote.entity';

@Injectable()
export class QuotesCronService {
  private readonly logger = new Logger(QuotesCronService.name);

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleStaleShippedQuotes() {
    this.logger.log('Iniciando cron job: Marcando envíos expirados como DELIVERED...');
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Buscar cotizaciones en estado SHIPPED que tengan shippedAt registrado
    const staleQuotes = await this.quoteRepository.find({
      where: {
        status: QuoteStatus.SHIPPED,
      },
    });

    let updatedCount = 0;
    for (const quote of staleQuotes) {
      // Solo procesar si tenemos un shippedAt real y han pasado más de 72h
      if (quote.shippedAt && quote.shippedAt < seventyTwoHoursAgo) {
        quote.status = QuoteStatus.DELIVERED;
        await this.quoteRepository.save(quote);
        this.logger.log(`Cotización ${quote.id} marcada como entregada automáticamente (enviada el ${quote.shippedAt.toISOString()}).`);
        updatedCount++;
      }
    }

    this.logger.log(`Cron job finalizado: ${updatedCount} cotizaciones actualizadas.`);
  }
}
