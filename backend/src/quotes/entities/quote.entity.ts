import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/user.entity';
import { MaterialRequest } from './material-request.entity';
import { QuoteItem } from './quote-item.entity';

export enum QuoteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED'
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @ManyToOne(() => MaterialRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: MaterialRequest;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: User;

  @OneToMany(() => QuoteItem, (item) => item.quote, { cascade: true })
  items: QuoteItem[];

  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.PENDING })
  status: QuoteStatus;

  @Column({ type: 'integer' }) // Centavos
  storeBaseTotal: number;

  @Column({ type: 'integer' }) // 14% de storeBaseTotal
  ferryCommission: number;

  @Column({ type: 'integer' }) // 19% de ferryCommission
  ferryIva: number;

  @Column({ type: 'integer' }) // Total que paga el cliente
  clientFinalTotal: number;

  @Column({ type: 'integer', default: 0 }) // Costo de envío
  transportCost: number;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  distanceKm?: number;

  @Column({ type: 'integer', nullable: true })
  rating?: number;

  @Column({ type: 'text', nullable: true })
  reviewComment?: string;

  @CreateDateColumn()
  createdAt: Date;
}
