import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  level: 'INFO' | 'WARN' | 'ERROR';

  @Column({ type: 'varchar' })
  message: string;

  @Column({ type: 'json', nullable: true })
  context?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
