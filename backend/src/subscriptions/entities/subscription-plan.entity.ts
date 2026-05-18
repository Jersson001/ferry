import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string; // ej: 'Gratuito', 'Profesional', 'Constructor Pro'

  @Column({ type: 'varchar', default: 'CONTRACTOR' })
  targetRole: string; // 'STORE' | 'CONTRACTOR' | 'CLIENT'

  @Column({ type: 'integer' })
  priceInCents: number; // Precio en centavos de COP (ej: 6000000 = $60.000 COP)

  @Column({ type: 'integer' })
  credits: number; // Tokens / postulaciones / leads por mes

  @Column({ type: 'integer', default: -1 })
  maxLeadsOrApplications: number; // -1 = ilimitado

  @Column({ type: 'integer', default: 6 })
  maxPortfolioItems: number; // Máximo ítems en galería de portafolio

  @Column({ type: 'boolean', default: false })
  hasVerifiedBadge: boolean; // Sello "Verificado" (Constructor Pro)

  @Column({ type: 'boolean', default: false })
  isPopular: boolean;

  @Column({ type: 'jsonb', nullable: true })
  features: string[]; // ['Sello Verificado', 'Estadísticas de éxito']

  @CreateDateColumn()
  createdAt: Date;
}
