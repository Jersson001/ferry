import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Quote } from './quote.entity';

/**
 * Mensaje del chat entre el cliente y la ferretería de una cotización aceptada.
 * La conversación es la cotización: solo participan quien hizo la solicitud y la ferretería que cotizó.
 * Lleva texto, un adjunto (imagen o PDF) o ambos.
 */
@Entity('quote_messages')
@Index(['quoteId', 'createdAt'])
export class QuoteMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_id' })
  quoteId: string;

  @ManyToOne(() => Quote, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ type: 'text', nullable: true })
  text?: string | null;

  @Column({ type: 'text', nullable: true, name: 'attachment_url' })
  attachmentUrl?: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'attachment_type' })
  attachmentType?: 'image' | 'pdf' | null;

  @Column({ type: 'varchar', nullable: true, name: 'attachment_name' })
  attachmentName?: string | null;

  @Column({ type: 'integer', nullable: true, name: 'attachment_size' })
  attachmentSize?: number | null;

  // Cuándo lo vio el destinatario (doble visto). Null = aún no.
  @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
