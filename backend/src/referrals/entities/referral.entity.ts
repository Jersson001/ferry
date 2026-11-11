import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

// Quién trae gente: una comunidad, un aliado, una ferretería. Lo crea solo el administrador.
@Entity('referral_codes')
export class ReferralCode {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

// Una cuenta tiene a lo sumo un referido y no se cambia.
@Entity('referrals')
export class Referral {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @CreateDateColumn()
  createdAt: Date;
}
