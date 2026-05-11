import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Quote } from './quote.entity';

@Entity('quote_items')
export class QuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quote_id' })
  quoteId: string;

  @ManyToOne(() => Quote, quote => quote.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  nombreComercial?: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'varchar' })
  unit: string;

  @Column({ type: 'varchar', nullable: true })
  sku?: string;

  @Column({ type: 'integer' }) // Oculto al cliente
  storeBaseUnitPrice: number;

  @Column({ type: 'integer' }) // Visible al cliente (con markup)
  clientFinalUnitPrice: number;

  @Column({ type: 'integer' }) // Oculto al cliente
  storeBaseSubtotal: number;

  @Column({ type: 'integer' }) // Visible al cliente
  clientFinalSubtotal: number;

  @Column({ type: 'boolean', default: true })
  available: boolean;
}
