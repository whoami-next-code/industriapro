import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type MailType =
  | 'ACCOUNT_CREATION'
  | 'PASSWORD_RESET'
  | 'ORDER_REGISTERED'
  | 'PROMOTIONAL'
  | 'QUOTATION_UPDATE';

@Entity('mail_logs')
export class MailLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  type: MailType;

  @Column({ type: 'varchar' })
  to: string;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId?: string;

  @Column({ type: 'varchar', nullable: true })
  providerErrorCode?: string;

  @Column({ type: 'varchar' })
  status: 'SUCCESS' | 'FAIL';

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', nullable: true })
  originalTo?: string;

  @Column({ type: 'int', default: 0 })
  opens: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'varchar', nullable: true })
  lastEvent?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastEventAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
