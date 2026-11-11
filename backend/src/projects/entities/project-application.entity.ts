import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { Project } from './project.entity';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED'
}

@Entity('project_applications')
export class ProjectApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, p => p.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'contractor_id' })
  contractorId: string; // El contratista que aplica

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractor_id' })
  contractor: User;

  @Column({ type: 'text' })
  proposal: string; // Mensaje o justificación

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  estimatedPriceInCents: number;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  // Calificación que el cliente le da al contratista contratado al terminar el proyecto
  @Column({ type: 'integer', nullable: true })
  rating?: number | null;

  @Column({ type: 'text', nullable: true })
  reviewComment?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  // Respuesta del contratista (una sola; no puede editar ni borrar la opinión)
  @Column({ type: 'text', nullable: true })
  reviewReply?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewRepliedAt?: Date | null;

  // Oculta por el administrador ante un abuso evidente; deja de contar en el promedio
  @Column({ type: 'boolean', default: false })
  reviewHidden: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
