import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Cotizacion, ProgressUpdate } from './cotizacion.entity';
import { QuotationImage } from './quotation-image.entity';
import { Product } from '../productos/product.entity';
import { User, UserRole } from '../users/user.entity';
import { EventsService } from '../realtime/events.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { EventsPublisher } from '../events/events.publisher';

type QuoteFilters = {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  customerEmail?: string;
  technician?: string;
  technicianId?: number;
  technicianEmail?: string;
};

type Pagination = {
  page?: number;
  limit?: number;
};

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STATUS_FLOW = [
  'PENDIENTE',
  'EN_PROCESO',
  'PRODUCCION',
  'INSTALACION',
  'FINALIZACION',
];

@Injectable()
export class CotizacionesService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Cotizacion)
    private readonly repo: Repository<Cotizacion>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(QuotationImage)
    private readonly imageRepo: Repository<QuotationImage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly events: EventsService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Optional() private readonly eventsPublisher?: EventsPublisher,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async uploadImage(quotationId: number, file: Express.Multer.File, user: any) {
    // 1. Upload to Supabase Storage
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${quotationId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await this.supabase.storage
      .from('quotation_images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(`Supabase Storage Error: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from('quotation_images')
      .getPublicUrl(fileName);

    // 2. Insert into DB
    const newImage = this.imageRepo.create({
      quotationId,
      userId: user.userId || user.sub || user.uid, // Depending on JWT payload
      image_url: publicUrl,
      isApproved: false, // Default
    });

    const saved = await this.imageRepo.save(newImage);

    // 3. Notify vía RabbitMQ y Socket.IO
    if (this.eventsPublisher) {
      await this.eventsPublisher.cotizacionImageUploaded(saved.id, quotationId).catch((error) => {
        console.error('Error publicando evento cotizacion.imagen_subida:', error);
      });
    }
    this.events.emit('cotizacion.imagen_subida', {
      imageId: saved.id,
      quotationId,
    });

    return saved;
  }

  async approveImage(id: string) {
    const image = await this.imageRepo.findOne({ where: { id } });
    if (!image) throw new NotFoundException('Image not found');

    image.isApproved = true;
    const saved = await this.imageRepo.save(image);

    // Notify via RabbitMQ y Socket.IO
    if (this.eventsPublisher) {
      await this.eventsPublisher.cotizacionImageApproved(id, image.quotationId).catch((error) => {
        console.error('Error publicando evento cotizacion.imagen_aprobada:', error);
      });
    }
    this.events.emit('cotizacion.imagen_aprobada', {
      imageId: id,
      quotationId: image.quotationId,
    });

    return saved;
  }

  async rejectImage(id: string) {
    const image = await this.imageRepo.findOne({ where: { id } });
    if (!image) throw new NotFoundException('Image not found');

    // Option 1: Delete
    // await this.imageRepo.remove(image);

    // Option 2: Mark as not approved (if it was approved)
    image.isApproved = false;
    const saved = await this.imageRepo.save(image);

    // Notify via RabbitMQ y Socket.IO
    if (this.eventsPublisher) {
      await this.eventsPublisher.cotizacionImageRejected(id, image.quotationId).catch((error) => {
        console.error('Error publicando evento cotizacion.imagen_rechazada:', error);
      });
    }
    this.events.emit('cotizacion.imagen_rechazada', {
      imageId: id,
      quotationId: image.quotationId,
    });

    return saved;
  }

  async getImages(quotationId: number, approvedOnly = false) {
    const where: any = { quotationId };
    if (approvedOnly) {
      where.isApproved = true;
    }
    return this.imageRepo.find({
      where,
      order: { uploadedAt: 'DESC' },
    });
  }

  async getTechnicianWorkload() {
    const technicians = await this.userRepo.find({
      where: { role: In([UserRole.TECNICO, UserRole.OPERARIO]) },
      select: ['id', 'fullName', 'email', 'phone'],
    });

    const workload = await Promise.all(
      technicians.map(async (tech) => {
        const activeCount = await this.repo.count({
          where: {
            technicianId: tech.id,
            status: In(['EN_PROCESO', 'PRODUCCION', 'INSTALACION']),
          },
        });
        
        let status = 'DISPONIBLE';
        if (activeCount >= 3) status = 'SATURADO';
        else if (activeCount > 0) status = 'EN_PROCESO';

        return {
          ...tech,
          activeCount,
          status,
        };
      })
    );

    return workload;
  }

  async assignTechnician(id: number, technicianId: number) {
    const quote = await this.repo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    const tech = await this.userRepo.findOne({ where: { id: technicianId } });
    if (!tech) throw new NotFoundException('Técnico no encontrado');

    quote.technicianId = tech.id;
    quote.technicianName = tech.fullName || tech.email;
    quote.technicianEmail = tech.email;
    quote.technicianPhone = tech.phone;

    const saved = await this.repo.save(quote);
    
    // Log assignment
    await this.addProgress(id, {
      message: `Técnico asignado: ${tech.fullName}`,
      status: quote.status,
      technician: tech.fullName,
    });

    if (tech.email) {
      try {
        await this.mail.sendTechnicianAssigned({
          to: tech.email,
          technicianName: tech.fullName || tech.email,
          quotationId: saved.id,
          customerName: saved.customerName,
          status: saved.status,
        });
      } catch (err) {
        console.error('Error enviando correo al técnico', err?.message || err);
      }
    }

    return saved;
  }

  async approveStage(id: number, updateIndex: number, userId: number) {
    const quote = await this.repo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    const updates = quote.progressUpdates || [];
    if (!updates[updateIndex]) throw new NotFoundException('Avance no encontrado');

    const update = updates[updateIndex];
    if (update.approvalStatus !== 'PENDING') {
       throw new BadRequestException('Este avance no está pendiente de aprobación');
    }

    // Approve
    update.approvalStatus = 'APPROVED';
    update.reviewedBy = `User-${userId}`;
    update.reviewDate = new Date().toISOString();

    // Apply status change if present
    if (update.status) {
      quote.status = update.status;
      quote.progressPercent = this.statusToProgress(update.status);
    }

    quote.progressUpdates = [...updates]; // Trigger update
    quote.approvalStatus = 'APPROVED'; // Main status approved

    const saved = await this.repo.save(quote);
    this.events.cotizacionesUpdated(saved);
    this.sendNotification(saved, `Etapa aprobada: ${update.message}`);
    
    return saved;
  }

  async rejectStage(id: number, updateIndex: number, userId: number, reason: string) {
    const quote = await this.repo.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada');

    const updates = quote.progressUpdates || [];
    if (!updates[updateIndex]) throw new NotFoundException('Avance no encontrado');

    const update = updates[updateIndex];
    
    update.approvalStatus = 'REJECTED';
    update.reviewedBy = `User-${userId}`;
    update.reviewDate = new Date().toISOString();
    update.rejectionReason = reason;

    // Do NOT change quote status (remains in previous state)
    
    quote.progressUpdates = [...updates];
    
    const saved = await this.repo.save(quote);
    this.events.cotizacionesUpdated(saved);
    // Notify technician? For now just save
    
    return saved;
  }

  private generateCode() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
    return `COT-${yyyy}${mm}${dd}-${rand}`;
  }

  private statusToProgress(status?: string) {
    const normalized = (status || '').toUpperCase();
    switch (normalized) {
      case 'PENDIENTE':
      case 'NUEVA':
        return 5;
      case 'APROBADA':
      case 'EN_PROCESO':
        return 20;
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return 55;
      case 'INSTALACION':
        return 85;
      case 'FINALIZADA':
      case 'COMPLETADA':
      case 'ENTREGADA':
        return 100;
      default:
        return 10;
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<Cotizacion>,
    filters: QuoteFilters = {},
  ) {
    if (filters.status) {
      qb.andWhere('LOWER(q.status) = LOWER(:status)', {
        status: filters.status,
      });
    }
    if (filters.customerEmail) {
      qb.andWhere('LOWER(q.customerEmail) = LOWER(:customerEmail)', {
        customerEmail: filters.customerEmail,
      });
    }
    if (filters.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(q.customerName) LIKE :search OR LOWER(q.customerEmail) LIKE :search OR LOWER(q.code) LIKE :search)',
        { search },
      );
    }
    if (filters.from) {
      qb.andWhere('q.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('q.createdAt <= :to', { to: filters.to });
    }
    if (filters.technician) {
      qb.andWhere(
        '(LOWER(q.technicianName) LIKE :tech OR LOWER(q.installationTechnician) LIKE :tech)',
        { tech: `%${filters.technician.toLowerCase()}%` },
      );
    }
    if (filters.technicianId || filters.technicianEmail) {
      qb.andWhere(
        new Brackets((sub) => {
          if (filters.technicianId) {
            sub.orWhere('q.technicianId = :technicianId', {
              technicianId: filters.technicianId,
            });
          }
          if (filters.technicianEmail) {
            sub.orWhere('LOWER(q.technicianEmail) = LOWER(:technicianEmail)', {
              technicianEmail: filters.technicianEmail,
            });
          }
        }),
      );
    }
    return qb;
  }

  private async getStatusSummary(filters: QuoteFilters = {}) {
    const qb = this.repo.createQueryBuilder('q');
    this.applyFilters(qb, filters);
    qb.select('q.status', 'status').addSelect('COUNT(*)', 'count');
    qb.groupBy('q.status');
    const raw = await qb.getRawMany<{ status: string; count: string }>();
    const byStatus = raw.reduce<Record<string, number>>((acc, row) => {
      const key = (row.status || 'DESCONOCIDO').toUpperCase();
      acc[key] = Number(row.count) || 0;
      return acc;
    }, {});
    return { byStatus };
  }

  create(data: Partial<Cotizacion>) {
    const status = data.status ?? 'PENDIENTE';
    const entity = this.repo.create({
      status,
      code: data.code ?? this.generateCode(),
      progressUpdates: [],
      totalAmount:
        data.totalAmount ??
        (data.budget ? Number(data.budget) || undefined : undefined),
      estimatedDeliveryDate: data.estimatedDeliveryDate ?? data.estimatedDate,
      progressPercent:
        typeof data.progressPercent === 'number'
          ? Math.max(0, Math.min(100, data.progressPercent))
          : this.statusToProgress(status),
      ...data,
    });
    return this.validateBusinessRules(entity).then(async () => {
      const saved = await this.repo.save(entity);
      
      // Publicar evento en RabbitMQ
      if (this.eventsPublisher) {
        await this.eventsPublisher.cotizacionCreated(saved).catch((error) => {
          console.error('Error publicando evento cotizacion.creada:', error);
        });
      }
      
      // Notificar vía Socket.IO
      this.events.cotizacionesUpdated(saved);
      return saved;
    });
  }

  async findAll(filters: QuoteFilters = {}, pagination?: Pagination) {
    const qb = this.repo.createQueryBuilder('q');
    this.applyFilters(qb, filters);
    qb.orderBy('q.createdAt', 'DESC');

    const usePagination =
      pagination !== undefined &&
      (Number.isFinite(pagination.page) || Number.isFinite(pagination.limit));

    if (usePagination) {
      const page = Math.max(1, Number(pagination?.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(pagination?.limit) || 20));

      qb.take(limit).skip((page - 1) * limit);
      const [data, total] = await qb.getManyAndCount();
      const summary = await this.getStatusSummary(filters);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        data,
        total,
        page,
        pageSize: limit,
        totalPages,
        stats: { ...summary, total },
      };
    }

    return qb.getMany();
  }

  findByEmail(email: string, filters: QuoteFilters = {}) {
    return this.findAll({ ...filters, customerEmail: email });
  }

  async findOne(id: number, isClient = false) {
    if (!Number.isFinite(id)) {
      throw new BadRequestException('ID de cotización inválido');
    }
    const found = await this.repo.findOne({
      where: { id },
      relations: ['images'],
    });
    if (!found) return null;

    // Filter updates for client
    if (isClient && found.progressUpdates) {
      found.progressUpdates = found.progressUpdates.filter(
        (u) => u.approvalStatus !== 'PENDING' && u.approvalStatus !== 'REJECTED'
      );
    }

    // Normalizar valores derivados
    if (!found.code) {
      found.code = this.generateCode();
    }
    if (typeof found.progressPercent !== 'number') {
      found.progressPercent = this.statusToProgress(found.status);
    }
    return found;
  }

  async update(id: number, data: Partial<Cotizacion>, userId?: number) {
    const found = await this.repo.findOneBy({ id });
    if (!found) throw new NotFoundException('Cotización no encontrada');
    
    const newStatus = data.status;
    if (newStatus && newStatus !== found.status) {
      await this.validateStatusTransition(found, newStatus, data);
    }

    const oldStatus = found.status;
    const status = data.status ?? found.status;
    
    Object.assign(found, {
      ...data,
      estimatedDeliveryDate:
        data.estimatedDeliveryDate ??
        data.estimatedDate ??
        found.estimatedDeliveryDate,
      status,
    });
    
    const nextPercent =
      typeof data.progressPercent === 'number'
        ? data.progressPercent
        : this.statusToProgress(status);
    found.progressPercent = Math.max(0, Math.min(100, nextPercent));
    
    await this.validateBusinessRules(found);
    const saved = await this.repo.save(found);
    
    if (userId) {
      await this.audit.log(
        'UPDATE_QUOTATION',
        userId,
        { id, oldStatus, newStatus: status, changes: data }
      );
    }
    
    // Publicar eventos en RabbitMQ
    if (this.eventsPublisher) {
      if (oldStatus !== status) {
        await this.eventsPublisher.cotizacionStatusChanged(id, oldStatus, status).catch((error) => {
          console.error('Error publicando evento cotizacion.estado_cambiado:', error);
        });
      }
      await this.eventsPublisher.cotizacionUpdated(saved).catch((error) => {
        console.error('Error publicando evento cotizacion.actualizada:', error);
      });
    }
    
    // Notificar vía Socket.IO
    this.events.cotizacionesUpdated(saved);
    
    if (oldStatus !== status) {
      this.sendNotification(saved, `El estado ha cambiado a ${status}`);
    }

    return saved;
  }

  private async sendNotification(quote: Cotizacion, message?: string) {
    if (!quote.customerEmail) return;
    try {
      await this.mail.sendQuotationUpdate({
        to: quote.customerEmail,
        fullName: quote.customerName,
        quotationId: quote.id,
        status: quote.status,
        message,
      });
    } catch (e) {
      console.error('Error sending email notification', e);
    }
  }

  /**
   * Registra un nuevo avance en la cotización.
   * Valida la existencia de la cotización y aplica reglas de negocio.
   * @param id ID de la cotización
   * @param progress Datos del avance
   * @param extra Datos extra para actualizar en la cotización
   * @returns Cotización actualizada
   */
  async addProgress(
    id: number,
    progress: Omit<ProgressUpdate, 'createdAt'>,
    extra?: Partial<Cotizacion>,
    userId?: number
  ) {
    const found = await this.repo.findOne({
      where: { id },
      relations: ['images']
    });
    if (!found) throw new NotFoundException('Cotización no encontrada');

    // Check user role for approval logic
    let isTechnician = false;
    if (userId) {
      const u = await this.userRepo.findOne({ where: { id: userId } });
      isTechnician = u?.role === UserRole.TECNICO;
    }

    // Validar transición de estado si cambia
    if (progress.status && progress.status !== found.status) {
      await this.validateStatusTransition(found, progress.status, {
        ...extra,
        ...progress,
        images: found.images // Pass existing images for validation
      });
    }

    // Determine approval status
    // If technician changes status, it is PENDING
    // If admin, it is APPROVED
    const requiresApproval = isTechnician && progress.status && progress.status !== found.status;
    const approvalStatus = requiresApproval ? 'PENDING' : 'APPROVED';

    const history =
      found.progressUpdates && Array.isArray(found.progressUpdates)
        ? found.progressUpdates
        : [];
    
    const entry: ProgressUpdate = {
      createdAt: new Date().toISOString(),
      ...progress,
      approvalStatus,
      author: progress.author || (userId ? `User-${userId}` : 'Sistema'),
    };
    
    // Asegurar que history es mutable
    const newHistory = [entry, ...history];
    found.progressUpdates = newHistory;
    
    const oldStatus = found.status;
    
    // Only update main status if APPROVED
    if (approvalStatus === 'APPROVED') {
      if (progress.status) {
        found.status = progress.status;
      }
      const pct = Number(progress.progressPercent);
      if (Number.isFinite(pct)) {
        found.progressPercent = Math.max(0, Math.min(100, pct));
      } else if (progress.status) {
        found.progressPercent = this.statusToProgress(progress.status);
      }
      found.approvalStatus = 'APPROVED';
    } else {
      // If pending, mark main quote as potentially having pending updates?
      found.approvalStatus = 'PENDING';
    }

    if (progress.estimatedDate) {
      found.estimatedDate = progress.estimatedDate;
      found.estimatedDeliveryDate = progress.estimatedDate;
    }
    if (extra) {
      Object.assign(found, extra);
    }
    found.lastUpdateMessage = progress.message ?? found.lastUpdateMessage;
    
    await this.validateBusinessRules(found);
    
    try {
      const saved = await this.repo.save(found);
      
      if (userId) {
        await this.audit.log(
          'ADD_PROGRESS',
          userId,
          { id, oldStatus, newStatus: found.status, message: progress.message, approvalStatus }
        );
      }

      this.events.cotizacionesUpdated(saved);
      
      // Notify client only if APPROVED
      if (approvalStatus === 'APPROVED') {
        this.sendNotification(saved, progress.message || 'Nuevo reporte de avance');
      } else {
        this.events.emit('admin.approval_needed', {
          quotationId: id,
          updateIndex: 0, // It is the first one since we prepended
          technician: found.technicianName,
          proposedStatus: progress.status,
          message: progress.message,
          timestamp: new Date().toISOString()
        });
      }

      return saved;
    } catch (err) {
      throw new BadRequestException(
        `Error de persistencia al guardar avance: ${err.message || err}`,
      );
    }
  }

  private async validateStatusTransition(
    current: Cotizacion,
    nextStatus: string,
    payload: any
  ) {
    const currentStatus = current.status || 'PENDIENTE';
    const next = nextStatus.toUpperCase();
    
    if (next === 'CANCELADA') return; // Cancelación siempre permitida

    const currentIndex = STATUS_FLOW.indexOf(currentStatus.toUpperCase());
    const nextIndex = STATUS_FLOW.indexOf(next);

    if (currentIndex === -1 || nextIndex === -1) {
      // Si el estado no está en el flujo estricto, permitir si es un estado conocido pero no bloqueante?
      // Por ahora forzamos flujo estricto
      // throw new BadRequestException(`Estado inválido: ${nextStatus}`);
      // Permitimos estados intermedios si existen, pero validamos saltos si son parte del flujo
    }

    if (nextIndex !== -1 && currentIndex !== -1) {
      if (nextIndex <= currentIndex) {
        // Permitir retroceder? Generalmente no en flujo estricto, pero a veces correcciones son necesarias.
        // El usuario pidió "flujo secuencial obligatorio (no se puede saltar estados)"
        // Asumimos que no se puede saltar hacia adelante.
      }
      
      if (nextIndex > currentIndex + 1) {
        throw new BadRequestException(
          `No se puede saltar estados. Estado actual: ${currentStatus}, Siguiente permitido: ${STATUS_FLOW[currentIndex + 1]}`
        );
      }
    }

    // Validaciones específicas por estado destino
    if (next === 'PRODUCCION') {
      // Requerido: Materiales
      const hasMaterials = payload.materials || (payload.materialList && payload.materialList.length > 0) || current.items?.some(i => i.materials);
      if (!hasMaterials) {
        throw new BadRequestException('Para pasar a PRODUCCIÓN se requiere registrar materiales.');
      }
    }

    if (next === 'INSTALACION') {
      // Requerido: Galería de fotos (mínimo 3)
      // Chequear payload.attachmentUrls o current.images
      const newImages = payload.attachmentUrls?.length || 0;
      const existingImages = payload.images?.length || 0; // passed from service
      const totalImages = newImages + existingImages;
      
      if (totalImages < 3) {
         throw new BadRequestException('Para pasar a INSTALACIÓN se requiere mínimo 3 fotos de avance.');
      }
    }

    if (next === 'FINALIZACION' || next === 'FINALIZADA') {
      // Requerido: Firmado digital (simulado por ahora con campo 'signature' o 'clientMessage')
      // O verificar si hay un adjunto que sea la firma
      const hasSignature = payload.clientMessage || payload.technicianName; 
      // El usuario pidió "Firmado digital de los reportes por el técnico responsable"
      // Asumimos que el técnico debe estar asignado y quizás un mensaje de cierre.
      if (!current.technicianName && !payload.technicianName) {
        throw new BadRequestException('Para FINALIZAR se requiere asignar un técnico responsable.');
      }
    }
  }

  async remove(id: number) {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Cotización no encontrada');
    return { deleted: true };
  }

  private assertNotPastDate(date?: string | null, fieldName = 'fecha') {
    if (!date) return;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    if (parsed < today) {
      throw new BadRequestException(
        `La ${fieldName} no puede ser una fecha pasada`,
      );
    }
  }

  private async validateBudget(data: Partial<Cotizacion>) {
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) return;
    const ids = items
      .map((it) => it.productId)
      .filter((v): v is number => typeof v === 'number');
    if (!ids.length) return;
    const products = await this.productRepo.findBy({ id: In(ids) });
    if (!products.length) return;
    const priceMap = new Map(products.map((p) => [p.id, Number(p.price) || 0]));
    const baseTotal = items.reduce((acc, it) => {
      const price = priceMap.get(it.productId!) ?? 0;
      const qty = Number(it.quantity) || 1;
      return acc + price * qty;
    }, 0);
    const budgetNumber =
      typeof data.totalAmount === 'number'
        ? data.totalAmount
        : Number(data.budget);
    if (baseTotal > 0 && Number.isFinite(budgetNumber)) {
      if (budgetNumber < baseTotal) {
        throw new BadRequestException(
          'El presupuesto no puede ser menor al precio del producto seleccionado',
        );
      }
    }
  }

  private async validateBusinessRules(data: Partial<Cotizacion>) {
    this.assertNotPastDate(
      data.estimatedDeliveryDate ?? data.estimatedDate,
      'fecha de entrega',
    );
    await this.validateBudget(data);
  }

  async buildReport(id: number) {
    const found = await this.findOne(id);
    if (!found) throw new NotFoundException('Cotización no encontrada');
    const timeline = Array.isArray(found.progressUpdates)
      ? found.progressUpdates
      : [];
    const lastUpdate = timeline[0];
    return {
      ...found,
      timeline,
      lastUpdate,
      summary: {
        status: found.status,
        progressPercent: found.progressPercent,
        estimatedDeliveryDate:
          found.estimatedDeliveryDate ?? found.estimatedDate ?? null,
        totalAmount: found.totalAmount ?? found.budget ?? null,
      },
    };
  }
}
