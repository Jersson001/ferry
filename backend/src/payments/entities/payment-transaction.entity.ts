import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';

export enum PaymentStatus {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  ERROR = 'ERROR',
  PENDING = 'PENDING'
}

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ID único que nos da Wompi
  @Column({ type: 'varchar', unique: true })
  transactionId: string;

  // Nuestra referencia interna (ej: quoteId + timestamp)
  @Column({ type: 'varchar' })
  reference: string;

  @Column({ name: 'quote_id', nullable: true })
  quoteId: string;

  @ManyToOne(() => Quote, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ type: 'integer' }) // Centavos
  amountInCents: number;

  @Column({ type: 'varchar', default: 'COP' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus })
  status: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  paymentMethodType: string;

  // Guardamos el signature recibido para auditoría
  @Column({ type: 'varchar', nullable: true })
  signature: string;

  @CreateDateColumn()
  createdAt: Date;
}
