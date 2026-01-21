import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contactos')
export class Contacto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 160 })
  email!: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ type: 'text' })
  mensaje!: string;

  @Column({ type: 'text', nullable: true })
  respuesta?: string;

  @Column({ type: 'timestamptz', nullable: true })
  respondidoEn?: Date;

  @Column({ type: 'text', nullable: true })
  respondidoPor?: string;

  @Column({ type: 'int', nullable: true })
  productoId?: number;

  @Column({ length: 20, default: 'nuevo' })
  estado!: 'nuevo' | 'en_proceso' | 'atendido' | 'cancelado';

  @Column({ type: 'int', nullable: true })
  technicianId?: number;

  @Column({ type: 'text', nullable: true })
  technicianName?: string;

  @Column({ type: 'text', nullable: true })
  technicianEmail?: string;

  @Column({ type: 'text', nullable: true })
  technicianPhone?: string;

  @Column({ type: 'json', nullable: true })
  reportes?: Array<{
    message: string;
    found?: string;
    resolved?: string;
    evidenceUrls?: string[];
    createdAt: string;
    technicianName?: string;
  }>;

  @CreateDateColumn()
  creadoEn!: Date;

  @UpdateDateColumn()
  actualizadoEn!: Date;
}
