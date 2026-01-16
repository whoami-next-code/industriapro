import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  VENDEDOR = 'VENDEDOR',
  TECNICO = 'TECNICO',
  CLIENTE = 'CLIENTE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'uuid', unique: true, nullable: true })
  supabaseUid?: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.CLIENTE })
  role: UserRole;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  document?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ nullable: true })
  resetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpires?: Date;

  @Column({ nullable: true })
  verificationToken?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
