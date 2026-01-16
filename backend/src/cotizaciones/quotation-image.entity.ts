import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cotizacion } from './cotizacion.entity';
import { User } from '../users/user.entity';

@Entity('quotation_images')
export class QuotationImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  image_url: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'quotation_id', type: 'bigint' })
  quotationId: number;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  @ManyToOne(() => Cotizacion, (cotizacion) => cotizacion.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotation_id' })
  quotation: Cotizacion;

  // Optional: Relation to User if needed
  // @ManyToOne(() => User)
  // @JoinColumn({ name: 'user_id', referencedColumnName: 'supabaseUid' })
  // user: User;
}
