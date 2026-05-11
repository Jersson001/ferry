import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

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

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  userLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  userLng: number;

  @CreateDateColumn()
  createdAt: Date;
}
