import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum UserTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Entity('user_tokens')
@Index(['tokenHash', 'type'])
export class UserToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', name: 'type' })
  type: UserTokenType;

  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'used_at' })
  usedAt?: Date;

  @Column({ type: 'varchar', nullable: true, name: 'ip' })
  ip?: string;

  @Column({ type: 'varchar', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'json', nullable: true, name: 'meta' })
  meta?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
