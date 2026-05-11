import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';

export enum LedgerType {
  EARNED = 'EARNED',   // Ganó créditos (compró plan, recargó, regalo)
  SPENT = 'SPENT'      // Gastó créditos (aplicó a un proyecto)
}

@Entity('credit_ledger')
export class CreditLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: LedgerType })
  type: LedgerType;

  @Column({ type: 'integer' })
  amount: number; // Siempre positivo. Si es SPENT, se resta lógicamente del balance.

  @Column({ type: 'varchar' })
  reference: string; // ej: 'PURCHASE-PlanPro', 'APPLY-Project123'

  @CreateDateColumn()
  createdAt: Date;
}
