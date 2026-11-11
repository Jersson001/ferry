import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Usos que cuentan contra un cupo mensual y no quedan en otra tabla (por ahora, las lecturas de IA).
@Entity('usage_log')
@Index(['userId', 'kind', 'createdAt'])
export class UsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  kind: 'AI';

  @CreateDateColumn()
  createdAt: Date;
}
