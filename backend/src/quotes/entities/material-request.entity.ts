import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { decimalComoNumero } from './decimal';

export enum RequestStatus {
  OPEN = 'OPEN',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  DRAFT = 'DRAFT' // Added for B-7 Paywalls
}

export enum PublicationType {
  FREE = 'FREE',
  MULTIMEDIA = 'MULTIMEDIA',
  VIP = 'VIP'
}

@Entity('material_requests')
export class MaterialRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  displayId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'jsonb' })
  items: any[];

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.OPEN })
  status: RequestStatus;

  @Column({ type: 'enum', enum: PublicationType, default: PublicationType.FREE })
  publicationType: PublicationType;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Column({ type: 'text', nullable: true, name: 'image_url' })
  imageUrl?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, transformer: decimalComoNumero })
  userLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, transformer: decimalComoNumero })
  userLng: number;

  // Cotizaciones que puede recibir, según el plan de quien la creó. Vacío en solicitudes anteriores (usan 5).
  @Column({ type: 'integer', nullable: true, name: 'max_quotes' })
  maxQuotes?: number | null;

  // Hasta dónde quiere el cliente que le coticen, en km desde la obra.
  @Column({ type: 'integer', default: 10 })
  radioKm: number;

  // Cuándo se publicó por última vez (al volver a enviarla). Vacío = se publicó al crearla.
  // La solicitud solo se puede cotizar durante la hora siguiente (ver cupos.ts).
  @Column({ type: 'timestamp', nullable: true, name: 'published_at' })
  publishedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
