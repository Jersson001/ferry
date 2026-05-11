import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string; // ej: 'Básico', 'Profesional', 'Premium'

  @Column({ type: 'integer' })
  priceInCents: number;

  @Column({ type: 'integer' })
  credits: number; // Cuántos tokens otorga el plan

  @Column({ type: 'boolean', default: false })
  isPopular: boolean;

  @Column({ type: 'jsonb', nullable: true })
  features: string[]; // ['Aplica a 5 proyectos', 'Soporte prioritario']

  @CreateDateColumn()
  createdAt: Date;
}
