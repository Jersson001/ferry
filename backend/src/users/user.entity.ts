import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  uid: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ default: 'Usuario' })
  displayName: string;

  @Column({ default: 'USER' })
  role: string;

  @Column({ type: 'text', nullable: true })
  photoURL?: string;

  @Column({ type: 'jsonb', nullable: true })
  portfolio?: any[];

  @Column({ type: 'jsonb', nullable: true })
  priceMemory?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  location?: { lat: number; lng: number; address?: string };

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-array', nullable: true })
  specialties?: string[];

  @Column({ nullable: true })
  rut?: string;

  @Column({ default: false })
  isProfileComplete: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
