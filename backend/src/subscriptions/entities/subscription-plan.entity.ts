import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string; // ej: 'Ferry Free', 'Profesional', 'Ferry Pro'

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

  // Cupos mensuales de los planes para usuarios. -1 = sin límite.
  @Column({ type: 'integer', default: -1 })
  aiTranscriptionsPerMonth: number; // Listas de materiales leídas por IA (texto o foto)

  @Column({ type: 'integer', default: -1 })
  maxProjectsPerMonth: number; // Proyectos que puede publicar

  @Column({ type: 'integer', default: 5 })
  maxQuotesPerRequest: number; // Ferreterías que pueden cotizar cada solicitud suya

  @Column({ type: 'integer', default: 0 })
  includedContactsPerMonth: number; // Contrataciones con el contacto del cliente incluido; las demás se pagan

  @Column({ type: 'jsonb', nullable: true })
  features: string[]; // ['Sello Verificado', 'Estadísticas de éxito']

  @CreateDateColumn()
  createdAt: Date;
}
