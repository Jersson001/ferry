import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/user.entity';
import { ProjectApplication } from './project-application.entity';

export enum ProjectStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string; // El cliente que publica

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  category: string; // ej: 'Plomería', 'Obra Civil'

  @Column({ type: 'integer', nullable: true })
  budgetInCents?: number; // Presupuesto estimado del cliente (opcional)

  @Column({ type: 'varchar' })
  location: string;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.OPEN })
  status: ProjectStatus;

  @OneToMany(() => ProjectApplication, app => app.project)
  applications: ProjectApplication[];

  @CreateDateColumn()
  createdAt: Date;
}
