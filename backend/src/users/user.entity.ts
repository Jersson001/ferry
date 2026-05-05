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

  @CreateDateColumn()
  createdAt: Date;
}
