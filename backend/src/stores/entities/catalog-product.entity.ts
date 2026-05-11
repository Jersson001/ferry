import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('catalog_products')
export class CatalogProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id' })
  storeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: User;

  @Column({ type: 'varchar' })
  sku: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'integer' }) // Precio en centavos para precisión
  price: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  family?: string;

  @Column({ type: 'boolean', default: false })
  isOnOffer: boolean;

  @Column({ type: 'integer', default: 0 })
  discountPercent: number;

  @CreateDateColumn()
  createdAt: Date;
}
