import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuotationImage } from './quotation-image.entity';
import { User } from '../users/user.entity';

export type MaterialUsage = {
  name: string;
  quantity: number;
  unit: string;
  provider?: string;
};

export type ProgressUpdate = {
  message: string;
  status?: string;
  estimatedDate?: string;
  attachmentUrls?: string[];
  materials?: string;
  materialList?: MaterialUsage[];
  createdAt: string;
  author?: string;
  channel?: string;
  progressPercent?: number;
  milestone?:
    | 'INICIO'
    | 'APROBADA'
    | 'PRODUCCION'
    | 'INSTALACION'
    | 'ENTREGA'
    | 'CIERRE';
  technician?: string;
  highlighted?: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewDate?: string;
  rejectionReason?: string;
  isPublic?: boolean;
};

export type QuoteItem = {
  productId?: number;
  name?: string;
  quantity: number;
  materials?: string;
  measures?: string;
  observations?: string;
  imageUrl?: string;
};

@Entity('quotes')
export class Cotizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  code?: string;

  @Column({ nullable: true })
  orderId?: number;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column({ nullable: true })
  customerDocument?: string;

  @Column({ nullable: true })
  customerCompany?: string;

  @Column({ nullable: true })
  customerPhone?: string;

  @Column({ nullable: true })
  productName?: string;

  @Column({ nullable: true })
  productImage?: string;

  // Información técnica / specs adicionales
  @Column({ type: 'json', nullable: true })
  productSpecs?: Record<string, any>;

  @Column({ type: 'json' })
  items: QuoteItem[];

  @OneToMany(() => QuotationImage, (image) => image.quotation)
  images: QuotationImage[];

  @Column({ nullable: true })
  customerAddress?: string;

  @Column({ default: 'PENDIENTE' })
  status: string;

  @Column({ type: 'text', nullable: true })
  need?: string;

  @Column({ nullable: true })
  estimatedDate?: string;

  @Column({ nullable: true })
  estimatedDeliveryDate?: string;

  @Column({ nullable: true })
  startDate?: string;

  @Column({ nullable: true })
  estimatedCompletionDate?: string;

  @Column({ nullable: true })
  completionDate?: string;

  @Column({ nullable: true })
  installationDate?: string;

  @Column({ nullable: true })
  budget?: string;

  @Column({ type: 'float', nullable: true, default: 0 })
  totalAmount?: number;

  @Column({ nullable: true })
  preferredChannel?: string;

  @Column({ nullable: true })
  technicianName?: string;

  @Column({ nullable: true })
  technicianPhone?: string;

  @Column({ nullable: true })
  technicianEmail?: string;

  @Column({ nullable: true })
  technicianId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'technicianId' })
  technicianUser?: User;

  @Column({ default: 'APPROVED' })
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ nullable: true })
  installationTechnician?: string;

  @Column({ type: 'text', nullable: true })
  technicianSignature?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  clientMessage?: string;

  @Column({ type: 'text', nullable: true })
  lastUpdateMessage?: string;

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  // URLs públicas de adjuntos subidos
  @Column({ type: 'simple-array', nullable: true })
  attachmentUrls?: string[];

  @Column({ type: 'json', nullable: true })
  progressUpdates?: ProgressUpdate[];

  @UpdateDateColumn()
  updatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
