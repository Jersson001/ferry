import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Una apertura del catálogo público de una tienda. `via` distingue quien escaneó el QR de quien abrió el enlace.
@Entity('catalog_visits')
export class CatalogVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @Column({ type: 'varchar', length: 10 })
  via: 'qr' | 'link';

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
