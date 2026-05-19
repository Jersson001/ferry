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
  category: string;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value?: number) => value,
      from: (value?: string) => value ? parseInt(value, 10) : undefined,
    },
  })
  budgetInCents?: number;

  /** Ciudad / Zona pública — visible en el feed */
  @Column({ type: 'varchar' })
  location: string;

  /** Dirección exacta confidencial — solo se revela al contratista aceptado */
  @Column({ type: 'text', nullable: true, name: 'exact_address' })
  exactAddress?: string;

  /** Contacto directo del cliente (teléfono) — solo se revela al contratista aceptado */
  @Column({ type: 'varchar', nullable: true, name: 'contact_phone' })
  contactPhone?: string;

  @Column({ type: 'boolean', default: false, name: 'is_urgent' })
  isUrgent: boolean;

  @Column({ type: 'text', nullable: true, name: 'image_url' })
  imageUrl?: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.OPEN })
  status: ProjectStatus;

  @OneToMany(() => ProjectApplication, app => app.project)
  applications: ProjectApplication[];

  @CreateDateColumn()
  createdAt: Date;
}
