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

    const staleQuotes = await this.quoteRepository.find({
      where: {
        status: QuoteStatus.SHIPPED,
        // En un caso real, trackearíamos updated_at del estado. 
        // Como simplificación usamos createdAt o asumimos que se quedaron pegados
      },
    });

    let updatedCount = 0;
    for (const quote of staleQuotes) {
      // Como no tenemos un log histórico de fechas de estado, simulamos
      // marcando todos los SHIPPED que fueron creados hace más de 72h.
      // O si se quisiera hacer bien habría que añadir un campo shippedAt.
      // Por simplicidad para el MVP, simplemente si tiene status shipped
      // y lleva vivo 3 días.
      if (quote.createdAt < seventyTwoHoursAgo) {
        quote.status = QuoteStatus.DELIVERED;
        await this.quoteRepository.save(quote);
        this.logger.log(`Cotización ${quote.id} marcada como entregada automáticamente por inactividad.`);
        updatedCount++;
      }
    }

    this.logger.log(`Cron job finalizado: ${updatedCount} cotizaciones actualizadas.`);
  }
}
