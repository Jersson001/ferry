import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Quote, QuoteStatus } from '../entities/quote.entity';
import { QuoteMessage } from '../entities/quote-message.entity';
import { StorageService } from '../../storage/storage.service';
import { PushService } from '../../push/push.service';

// El chat se abre cuando el cliente acepta la cotización y sigue disponible hasta la entrega y después.
export const ESTADOS_CON_CHAT = [QuoteStatus.ACCEPTED, QuoteStatus.PAID, QuoteStatus.PREPARING, QuoteStatus.SHIPPED, QuoteStatus.DELIVERED];

export const MAX_TEXTO = 2000;
// Como en Worky: se cargan los últimos 100 mensajes; lo anterior no se pagina.
const ULTIMOS = 100;

type Rol = 'client' | 'store';

export interface MensajeChat {
  id: string;
  from: 'me' | 'other';
  text: string | null;
  attachment: { url: string; type: 'image' | 'pdf'; name: string | null; size: number | null } | null;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class QuoteChatService {
  private readonly logger = new Logger(QuoteChatService.name);

  constructor(
    @InjectRepository(Quote) private quotes: Repository<Quote>,
    @InjectRepository(QuoteMessage) private messages: Repository<QuoteMessage>,
    private storage: StorageService,
    @Optional() private push?: PushService,
  ) {}

  // Quién es el usuario en esta conversación; falla si no participa o si el chat aún no está abierto.
  private async participante(quoteId: string, userId: string): Promise<{ quote: Quote; rol: Rol; otroId: string }> {
    const quote = await this.quotes.findOne({ where: { id: quoteId }, relations: ['request'] });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    const clienteId = quote.request?.userId;
    let rol: Rol;
    if (userId === clienteId) rol = 'client';
    else if (userId === quote.storeId) rol = 'store';
    else throw new ForbiddenException('No participas en esta cotización');
    if (!ESTADOS_CON_CHAT.includes(quote.status)) {
      throw new BadRequestException('El chat se abre cuando el cliente acepta la cotización');
    }
    return { quote, rol, otroId: rol === 'client' ? quote.storeId : clienteId };
  }

  private aVista(m: QuoteMessage, userId: string): MensajeChat {
    return {
      id: m.id,
      from: m.senderId === userId ? 'me' : 'other',
      text: m.text ?? null,
      attachment: m.attachmentUrl
        ? { url: m.attachmentUrl, type: m.attachmentType ?? 'image', name: m.attachmentName ?? null, size: m.attachmentSize ?? null }
        : null,
      read: !!m.readAt,
      createdAt: m.createdAt,
    };
  }

  /** Últimos mensajes, en orden cronológico. Abrir el chat marca como leído lo que llegó del otro lado. */
  async listar(quoteId: string, userId: string) {
    const { quote, rol } = await this.participante(quoteId, userId);
    await this.messages.update(
      { quoteId, senderId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
    // Se pide descendente y se da la vuelta: con ascendente el límite recortaría los más nuevos.
    const filas = await this.messages.find({ where: { quoteId }, order: { createdAt: 'DESC' }, take: ULTIMOS });
    // Mientras no haya pagado, el cliente no sabe qué ferretería es (estrategia a ciegas).
    const aCiegas = quote.status === QuoteStatus.ACCEPTED;
    return {
      rol,
      aCiegas,
      status: quote.status,
      messages: filas.reverse().map(m => this.aVista(m, userId)),
    };
  }

  /** Envía texto, un adjunto (imagen o PDF en data URL) o ambos. */
  async enviar(quoteId: string, userId: string, data: { text?: unknown; attachment?: { dataUrl?: unknown; name?: unknown } }): Promise<MensajeChat> {
    const { quote, rol, otroId } = await this.participante(quoteId, userId);
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (text.length > MAX_TEXTO) throw new BadRequestException(`El mensaje no puede pasar de ${MAX_TEXTO} caracteres`);

    let adjunto: { url: string; type: 'image' | 'pdf'; size: number; name: string | null } | null = null;
    if (data?.attachment?.dataUrl !== undefined) {
      if (typeof data.attachment.dataUrl !== 'string') throw new BadRequestException('Adjunto inválido');
      try {
        const guardado = await this.storage.saveChatAttachment(data.attachment.dataUrl, userId);
        const nombre = typeof data.attachment.name === 'string' ? data.attachment.name.slice(0, 120) : null;
        adjunto = { ...guardado, name: nombre };
      } catch (err: any) {
        throw new BadRequestException(err?.message || 'No se pudo guardar el archivo');
      }
    }
    if (!text && !adjunto) throw new BadRequestException('Escribe un mensaje o adjunta una imagen o un PDF');

    const guardado = await this.messages.save(this.messages.create({
      quoteId,
      senderId: userId,
      text: text || null,
      attachmentUrl: adjunto?.url ?? null,
      attachmentType: adjunto?.type ?? null,
      attachmentName: adjunto?.name ?? null,
      attachmentSize: adjunto?.size ?? null,
    }));

    // Sin await: el aviso al otro lado no debe demorar ni romper el envío.
    const resumen = text ? text.slice(0, 120) : adjunto?.type === 'pdf' ? '📄 Te envió un PDF' : '📷 Te envió una imagen';
    void this.push?.avisarUsuario(otroId, {
      title: rol === 'client' ? 'Mensaje del cliente' : quote.status === QuoteStatus.ACCEPTED ? 'Mensaje de la ferretería' : 'Mensaje de tu ferretería',
      body: resumen,
      url: '/',
    });
    return this.aVista(guardado, userId);
  }

  /** Mensajes sin leer por cotización, para los avisos en las listas. */
  async noLeidos(userId: string): Promise<Record<string, number>> {
    const filas = await this.messages.createQueryBuilder('m')
      .innerJoin('m.quote', 'q')
      .innerJoin('q.request', 'r')
      .select('m.quoteId', 'quoteId')
      .addSelect('COUNT(*)', 'total')
      .where('m.readAt IS NULL')
      // Dos parámetros: Postgres fija el tipo de cada uno por su primer uso, y sender_id es texto
      // mientras store_id y user_id son uuid.
      .andWhere('m.senderId != :remitente', { remitente: userId })
      .andWhere('(q.storeId = :participante OR r.userId = :participante)', { participante: userId })
      .andWhere('q.status IN (:...estados)', { estados: ESTADOS_CON_CHAT })
      .groupBy('m.quoteId')
      .getRawMany<{ quoteId: string; total: string }>();
    return Object.fromEntries(filas.map(f => [f.quoteId, Number(f.total)]));
  }

  // Para pruebas y limpieza: borra los mensajes de cotizaciones dadas.
  async borrarDe(quoteIds: string[]): Promise<void> {
    if (quoteIds.length) await this.messages.delete({ quoteId: In(quoteIds) });
  }
}
